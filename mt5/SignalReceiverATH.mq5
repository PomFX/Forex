//+------------------------------------------------------------------+
//|                                                SignalReceiverATH.mq5 |
//|                                      ATH Trader - MT5 Integration |
//|          รับ Signal เฉพาะ XAU/USD เปิด Pending Order อัตโนมัติ        |
//+------------------------------------------------------------------+
#property copyright "ATH Trader"
#property version   "2.2"
#property description "Multi-symbol Pending Order EA — category filter: Commodities/Forex/Crypto"
#property description "Docs: https://forex-rouge-gamma.vercel.app"

//--- Input Parameters
input string   API_URL          = "https://forex-rouge-gamma.vercel.app/api/signals/mt5";
input string   API_KEY          = "d0d52fa0d8070ec18b99375dd25baa5b46338653dd5ea7c8";
input double   LOT_SIZE         = 0.01;        // Fixed lot size
input int      POLL_INTERVAL    = 60;          // Poll interval (seconds)
input int      MAGIC_NUMBER     = 20260605;    // Magic number
input int      SLIPPAGE         = 30;          // Max slippage when order fills (points)
input bool     USE_RISK_PCT     = false;       // Use risk-based lot sizing
input double   RISK_PERCENT     = 1.0;         // Risk % per trade
input int      TP_MODE          = 1;           // 1=TP1, 2=TP2, 3=TP3
input bool     FILTER_COMMODITIES = true;      // รับ Signal Commodities (XAU/USD, XAG/USD)
input bool     FILTER_FOREX       = true;      // รับ Signal Forex (EUR, GBP, JPY, CHF, AUD, NZD, CAD)
input bool     FILTER_CRYPTO      = true;      // รับ Signal Crypto (BTC, ETH, XRP)

//--- Global Variables
int       g_processedIds[50];
int       g_processedCount = 0;
bool      g_isBusy        = false;

//--- Symbol Cache
string    g_cachedSymbol[2][20];
int       g_cacheCount = 0;

//+------------------------------------------------------------------+
//| Find real MT5 symbol name from API pair (handles suffixes, GOLD)  |
//+------------------------------------------------------------------+
string FindSymbol(string pair)
{
   string base = pair;
   StringReplace(base, "/", "");

   for(int i = 0; i < g_cacheCount; i++)
      if(g_cachedSymbol[0][i] == pair)
         return g_cachedSymbol[1][i];

   if(TrySymbol(base))       { CacheAdd(pair, base); return base; }
   if(base == "XAUUSD")
      if(TrySymbol("GOLD"))  { CacheAdd(pair, "GOLD"); return "GOLD"; }

    string suffixes[] = {".m", ".pro", ".r", ".ecn", ".x", ".c", ".f", ".a", ".b", ".t", ".raw", "u"};
   for(int s = 0; s < ArraySize(suffixes); s++)
   {
      string candidate = base + suffixes[s];
      if(TrySymbol(candidate)) { CacheAdd(pair, candidate); return candidate; }
   }

    int total = SymbolsTotal(false);
    for(int j = 0; j < total; j++)
    {
       string sym = SymbolName(j, false);
        if(StringFind(sym, base) >= 0)
       {
          SymbolSelect(sym, true);
          if(SymbolInfoDouble(sym, SYMBOL_BID) > 0)
          {
             CacheAdd(pair, sym);
             return sym;
          }
       }
    }

   Print("[FindSymbol] NOT FOUND: ", pair);
   return "";
}

bool TrySymbol(string sym)
{
   if(!SymbolSelect(sym, true)) return false;
   return (SymbolInfoDouble(sym, SYMBOL_BID) > 0);
}

void CacheAdd(string pair, string symbol)
{
   if(g_cacheCount >= 20) return;
   g_cachedSymbol[0][g_cacheCount] = pair;
   g_cachedSymbol[1][g_cacheCount] = symbol;
   g_cacheCount++;
   Print("[FindSymbol] ", pair, " -> ", symbol);
}

//+------------------------------------------------------------------+
//| Get pair category                                                 |
//+------------------------------------------------------------------+
string GetPairCategory(string pair)
{
   if(pair == "XAU/USD" || pair == "XAG/USD") return "commodities";
   string forexPairs[] = {"EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD"};
   for(int i = 0; i < ArraySize(forexPairs); i++)
      if(pair == forexPairs[i]) return "forex";
   string cryptoPairs[] = {"BTC/USD", "ETH/USD", "XRP/USD"};
   for(int i = 0; i < ArraySize(cryptoPairs); i++)
      if(pair == cryptoPairs[i]) return "crypto";
   return "unknown";
}

//+------------------------------------------------------------------+
//| Extract a JSON value by key                                       |
//+------------------------------------------------------------------+
string JsonExtract(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start < 0) return "";

   start += StringLen(search);
   while(start < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, start);
      if(ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r') break;
      start++;
   }

   if(StringGetCharacter(json, start) == '"')
   {
      start++;
      int end = start;
      while(end < StringLen(json) && StringGetCharacter(json, end) != '"') end++;
      return StringSubstr(json, start, end - start);
   }

   if(StringFind(json, "null", start) == start) return "";

   int end = start;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\n' || ch == '\r') break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Fetch signal from API                                            |
//+------------------------------------------------------------------+
bool FetchSignal(string &json)
{
   char   data[];
   char   result[];
   string resultHeaders;
   string headers = "X-MT5-Key: " + API_KEY + "\r\n"
                  + "Accept: application/json\r\n";

   int res = WebRequest("GET", API_URL, headers, 5000, data, result, resultHeaders);

   if(res == -1 || res > 599 || res < 100)
   {
      int err = GetLastError();
      Print("[SignalReceiver] WebRequest FAILED | res=", res, " LastError=", err);
      if(err == 4014)
         Print("[SignalReceiver] ERROR 4014: URL not in allowed list!");
      else
         Print("[SignalReceiver] Go to Tools -> Options -> Expert Advisors -> Allow WebRequest for: https://forex-rouge-gamma.vercel.app");
      return false;
   }

   if(res != 200)
   {
      Print("[SignalReceiver] WebRequest HTTP ", res, " | Server returned error");
      return false;
   }

   json = CharArrayToString(result);
   return true;
}

//+------------------------------------------------------------------+
//| Cancel ALL pending orders with our magic number                   |
//+------------------------------------------------------------------+
void CancelAllPending()
{
   int total = OrdersTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0)
      {
         if(OrderGetInteger(ORDER_MAGIC) == MAGIC_NUMBER &&
            (OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_LIMIT  ||
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_LIMIT ||
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_STOP   ||
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_STOP))
         {
            MqlTradeRequest  request  = {};
            MqlTradeResult   result   = {};
            request.action   = TRADE_ACTION_REMOVE;
            request.order    = ticket;

            if(OrderSend(request, result))
               Print("[SignalReceiver] Cancelled pending order #", ticket);
            else
               Print("[SignalReceiver] Failed to cancel #", ticket, " retcode=", result.retcode);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Cancel pending order for a specific symbol                        |
//+------------------------------------------------------------------+
void CancelPendingBySymbol(string symbol)
{
   int total = OrdersTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0)
      {
         if(OrderGetInteger(ORDER_MAGIC) == MAGIC_NUMBER &&
            OrderGetString(ORDER_SYMBOL) == symbol &&
            (OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_LIMIT  ||
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_LIMIT ||
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_STOP   ||
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_STOP))
         {
            MqlTradeRequest  request  = {};
            MqlTradeResult   result   = {};
            request.action   = TRADE_ACTION_REMOVE;
            request.order    = ticket;

            if(OrderSend(request, result))
               Print("[SignalReceiver] Cancelled pending ", symbol, " #", ticket);
            else
               Print("[SignalReceiver] Failed to cancel ", symbol, " #", ticket, " retcode=", result.retcode);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Get existing positions with our magic number                      |
//+------------------------------------------------------------------+
int CountPositions()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionSelectByTicket(PositionGetTicket(i)))
         if(PositionGetInteger(POSITION_MAGIC) == MAGIC_NUMBER)
            count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| Place pending order (auto STOP/LIMIT based on entry vs market)    |
//+------------------------------------------------------------------+
bool PlacePending(string symbol, string direction, double entry, double tp, double sl, int signalId)
{
   double ask    = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid    = SymbolInfoDouble(symbol, SYMBOL_BID);
   double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int    digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   int    stopLvl = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double stopDist = stopLvl * point;

   entry = NormalizeDouble(entry, digits);

   // Determine pending order type
   ENUM_ORDER_TYPE orderType;
   double price;

   if(direction == "BUY")
   {
      if(entry < ask)
         orderType = ORDER_TYPE_BUY_LIMIT;   // Wait for price to drop
      else
         orderType = ORDER_TYPE_BUY_STOP;    // Wait for price to rise through
      price = entry;
   }
   else // SELL
   {
      if(entry > bid)
         orderType = ORDER_TYPE_SELL_LIMIT;  // Wait for price to rise
      else
         orderType = ORDER_TYPE_SELL_STOP;   // Wait for price to fall through
      price = entry;
   }

   // Normalize SL & TP
   double slPrice = 0, tpPrice = 0;

   if(sl > 0)
   {
      slPrice = NormalizeDouble(sl, digits);
      // For pending orders, SL/TP are relative to entry, not market
      // But MT5 still validates SL/TP against current market
      // Validate: SL must be on correct side of entry
      if(direction == "BUY" && slPrice >= entry)
      {
         Print("[SignalReceiver] BUY SL above entry, adjusting...");
         slPrice = NormalizeDouble(entry - stopDist * 10, digits);
      }
      else if(direction == "SELL" && slPrice <= entry)
      {
         Print("[SignalReceiver] SELL SL below entry, adjusting...");
         slPrice = NormalizeDouble(entry + stopDist * 10, digits);
      }
   }

   if(tp > 0)
   {
      tpPrice = NormalizeDouble(tp, digits);
      if(direction == "BUY" && tpPrice <= entry)
      {
         Print("[SignalReceiver] BUY TP below entry, adjusting...");
         tpPrice = NormalizeDouble(entry + stopDist * 10, digits);
      }
      else if(direction == "SELL" && tpPrice >= entry)
      {
         Print("[SignalReceiver] SELL TP above entry, adjusting...");
         tpPrice = NormalizeDouble(entry - stopDist * 10, digits);
      }
   }

   // Lot size
   double lotSize = LOT_SIZE;
   if(USE_RISK_PCT && sl > 0)
   {
      double riskMoney = AccountInfoDouble(ACCOUNT_BALANCE) * RISK_PERCENT / 100.0;
      double slPoints  = MathAbs(entry - sl) / point;
      if(slPoints > 0)
      {
         double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
         if(tickValue > 0)
         {
            lotSize = NormalizeDouble(riskMoney / (slPoints * tickValue), 2);
            double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
            double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
            if(lotSize < minLot) lotSize = minLot;
            if(lotSize > maxLot) lotSize = maxLot;
         }
      }
   }
   lotSize = NormalizeDouble(lotSize, 2);

   // Debug log
   string typeStr;
   switch(orderType)
   {
      case ORDER_TYPE_BUY_LIMIT:  typeStr = "BUY LIMIT";  break;
      case ORDER_TYPE_BUY_STOP:   typeStr = "BUY STOP";   break;
      case ORDER_TYPE_SELL_LIMIT: typeStr = "SELL LIMIT"; break;
      case ORDER_TYPE_SELL_STOP:  typeStr = "SELL STOP";  break;
   }

   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] PLACING PENDING ORDER:");
   Print("  Symbol   : ", symbol, " (digits=", digits, " stopLvl=", stopLvl, ")");
   Print("  Type     : ", typeStr);
   Print("  Entry    : ", entry, " (Ask=", ask, " Bid=", bid, ")");
   Print("  SL       : ", slPrice);
   Print("  TP       : ", tpPrice);
   Print("  Lot      : ", lotSize);
   Print("  Signal   : #", signalId);
   Print("══════════════════════════════════════════════");

   // Send order
   MqlTradeRequest request  = {};
   MqlTradeResult  result   = {};

   request.action    = TRADE_ACTION_PENDING;
   request.symbol    = symbol;
   request.volume    = lotSize;
   request.type      = orderType;
   request.price     = price;
   request.sl        = slPrice;
   request.tp        = tpPrice;
   request.magic     = MAGIC_NUMBER;
   request.comment   = "ATH #" + IntegerToString(signalId);

   if(OrderSend(request, result))
   {
      Print("[SignalReceiver] PENDING ORDER PLACED | Ticket=", result.order);
      return true;
   }
   else
   {
      Print("[SignalReceiver] Pending order FAILED | RetCode=", result.retcode, " ", result.comment);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Track processed signal IDs                                        |
//+------------------------------------------------------------------+
bool IsProcessed(int signalId)
{
   for(int i = 0; i < g_processedCount; i++)
      if(g_processedIds[i] == signalId) return true;
   return false;
}

void MarkProcessed(int signalId)
{
   if(g_processedCount >= 50)
   {
      for(int i = 0; i < 49; i++) g_processedIds[i] = g_processedIds[i+1];
      g_processedCount = 49;
   }
   g_processedIds[g_processedCount++] = signalId;
}

//+------------------------------------------------------------------+
//| Process a single signal object                                    |
//+------------------------------------------------------------------+
void ProcessOneSignal(string obj)
{
   int    signalId  = (int)StringToInteger(JsonExtract(obj, "id"));
   string pair      = JsonExtract(obj, "pair");
   string direction = JsonExtract(obj, "direction");
   double entry     = StringToDouble(JsonExtract(obj, "entry"));
   double tp1       = StringToDouble(JsonExtract(obj, "tp1"));
   double tp2       = StringToDouble(JsonExtract(obj, "tp2"));
   double tp3       = StringToDouble(JsonExtract(obj, "tp3"));
   double sl        = StringToDouble(JsonExtract(obj, "sl"));
   string reason    = JsonExtract(obj, "reason");

   if(signalId == 0 || pair == "" || direction == "")
   {
      Print("[SignalReceiver] Incomplete signal data — skipping");
      return;
   }

   // Already processed this signal
   if(IsProcessed(signalId))
      return;

   // Check category filter
   string category = GetPairCategory(pair);
   bool allowed = (FILTER_COMMODITIES && category == "commodities") ||
                  (FILTER_FOREX && category == "forex") ||
                  (FILTER_CRYPTO && category == "crypto") ||
                  category == "unknown";
   if(!allowed)
   {
      Print("[SignalReceiver] Skipped ", pair, " (", category, " filter disabled)");
      return;
   }

   // Match signal pair to broker symbol
   string symbol = FindSymbol(pair);
   if(symbol == "")
   {
      Print("[SignalReceiver] Symbol not found for: ", pair);
      return;
   }

   // Check that symbol has live prices
   if(SymbolInfoDouble(symbol, SYMBOL_BID) <= 0 || SymbolInfoDouble(symbol, SYMBOL_ASK) <= 0)
   {
      Print("[SignalReceiver] No market prices for ", symbol, " — skipping");
      return;
   }

   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] NEW SIGNAL #", signalId);
   Print("  Pair     : ", pair, " -> ", symbol);
   Print("  Direction: ", direction);
   Print("  Entry    : ", entry);
   Print("  TP1/2/3  : ", tp1, " / ", tp2, " / ", tp3);
   Print("  SL       : ", sl);
   Print("  Reason   : ", reason);

   // Select TP
   double tp = 0;
   switch(TP_MODE)
   {
      case 1: tp = tp1; break;
      case 2: tp = tp2; break;
      case 3: tp = tp3; break;
   }

   // Cancel existing pending for this symbol only
   Print("[SignalReceiver] New signal for ", symbol, " — cancelling previous pending for this symbol");
   CancelPendingBySymbol(symbol);

   // Place pending order
   if(PlacePending(symbol, direction, entry, tp, sl, signalId))
      MarkProcessed(signalId);
}

//+------------------------------------------------------------------+
//| Process all signals from API                                      |
//+------------------------------------------------------------------+
void ProcessSignal()
{
   if(g_isBusy) return;
   g_isBusy = true;
   Print("[SignalReceiver] Checking for new signals...");

   string json;
   if(!FetchSignal(json))
   {
      g_isBusy = false;
      return;
   }

   // No active signals or error — keep existing pending orders
   if(json == "[]" || json == "null" || StringFind(json, "\"error\"") >= 0)
   {
      g_isBusy = false;
      return;
   }

   // Parse JSON array — extract each object
   int pos = 0;
   while(pos < StringLen(json))
   {
      // Find opening brace
      int start = StringFind(json, "{", pos);
      if(start < 0) break;

      // Find matching closing brace
      int depth = 0;
      int end = start;
      for(int i = start; i < StringLen(json); i++)
      {
         ushort ch = StringGetCharacter(json, i);
         if(ch == '{') depth++;
         if(ch == '}') depth--;
         if(depth == 0) { end = i; break; }
      }

      string obj = StringSubstr(json, start, end - start + 1);
      pos = end + 1;

      ProcessOneSignal(obj);
   }

   g_isBusy = false;
}

//+------------------------------------------------------------------+
//| Expert initialization                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver v2.2] MULTI-SYMBOL PENDING ORDER EA");
   Print("  Source   : signal.json (Common Files)");
   Print("  Interval : ", POLL_INTERVAL, " seconds");
   Print("  Lot Size : ", LOT_SIZE);
   Print("  Magic    : ", MAGIC_NUMBER);
   Print("  TP Mode  : ", TP_MODE);
   Print("  Filters  : Commo=", FILTER_COMMODITIES, " Forex=", FILTER_FOREX, " Crypto=", FILTER_CRYPTO);
   Print("══════════════════════════════════════════════");
   EventSetTimer(POLL_INTERVAL);
   ProcessSignal();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Timer event                                                       |
//+------------------------------------------------------------------+
void OnTimer()
{
   ProcessSignal();
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                            |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[SignalReceiver] EA stopped. Pending orders left active.");
}

//+------------------------------------------------------------------+
//| Chart event — F5 = manual check, F6 = cancel all pending          |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long   &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_KEYDOWN)
   {
      // F5 = manual refresh
      if((int)lparam == 116)
      {
         Print("[SignalReceiver] Manual signal check (F5)");
         ProcessSignal();
      }
      // F6 = cancel all pending orders
      if((int)lparam == 117)
      {
         Print("[SignalReceiver] Manual cancel all pending (F6)");
         CancelAllPending();
      }
   }
}
