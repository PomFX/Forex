//+------------------------------------------------------------------+
//|                                                SignalReceiver.mq5 |
//|                                      ATH Trader - MT5 Integration |
//|   ดึงสัญญาณจาก Web API แล้วเปิดออเดอร์ใน MT5 แบบอัตโนมัติ           |
//+------------------------------------------------------------------+
#property copyright "ATH Trader"
#property version   "1.0"
#property description "MT5 EA - Receive signals from ATH Trader web API"
#property description "Docs: https://forex-rouge-gamma.vercel.app"

//--- Input Parameters
input string   API_URL          = "https://forex-rouge-gamma.vercel.app/api/signals/mt5";
input string   API_KEY          = "d0d52fa0d8070ec18b99375dd25baa5b46338653dd5ea7c8";
input double   LOT_SIZE         = 0.01;        // Fixed lot size
input int      POLL_INTERVAL    = 60;          // Poll interval (seconds)
input int      MAGIC_NUMBER     = 20260605;    // Magic number
input int      SLIPPAGE         = 30;          // Max slippage (points)
input bool     USE_RISK_PCT     = false;       // Use risk-based lot sizing
input double   RISK_PERCENT     = 1.0;         // Risk % per trade
input int      TP_MODE          = 1;           // 1=TP1, 2=TP2, 3=TP3

//--- Global Variables
int       g_lastSignalId = 0;
datetime  g_lastPollTime = 0;
bool      g_isBusy        = false;

//+------------------------------------------------------------------+
//| Cache for resolved symbols to avoid repeated full scans           |
//+------------------------------------------------------------------+
string g_cachedSymbol[2][20]; // [0]=pair [1]=resolved_symbol
int    g_cacheCount = 0;

//+------------------------------------------------------------------+
//| Find real MT5 symbol name from API pair (handles suffixes, GOLD)  |
//+------------------------------------------------------------------+
string FindSymbol(string pair)
{
   string base = pair;
   StringReplace(base, "/", "");

   // Check cache
   for(int i = 0; i < g_cacheCount; i++)
   {
      if(g_cachedSymbol[0][i] == pair)
         return g_cachedSymbol[1][i];
   }

   // Test if a symbol exists (try select, then check price)
   if(TrySymbol(base))
   {
      CacheAdd(pair, base);
      return base;
   }

   // Special mappings
   if(base == "XAUUSD")
   {
      if(TrySymbol("GOLD"))       { CacheAdd(pair, "GOLD"); return "GOLD"; }
   }
   if(base == "XAGUSD")
   {
      if(TrySymbol("SILVER"))     { CacheAdd(pair, "SILVER"); return "SILVER"; }
   }

   // Try common suffixes (most brokers use these)
   string suffixes[] = {".m", ".pro", ".r", ".ecn", ".x", ".c", ".f", ".a", ".b", ".t", ".raw"};
   for(int s = 0; s < ArraySize(suffixes); s++)
   {
      string candidate = base + suffixes[s];
      if(TrySymbol(candidate))
      {
         CacheAdd(pair, candidate);
         return candidate;
      }
   }

   // Full scan all broker symbols (slow, do once and cache)
   int total = SymbolsTotal(false);
   for(int j = 0; j < total; j++)
   {
      string sym = SymbolName(j, false);
      // Match if symbol starts with or equals our base
      if(StringFind(sym, base) >= 0)
      {
         SymbolSelect(sym, true);
         if(SymbolInfoDouble(sym, SYMBOL_BID) > 0)
         {
            Print("[FindSymbol] Full scan match: ", pair, " -> ", sym);
            CacheAdd(pair, sym);
            return sym;
         }
      }
   }

   Print("[FindSymbol] NOT FOUND: ", pair, " (base=", base, "). Add symbol to Market Watch first.");
   return "";
}

//+------------------------------------------------------------------+
//| Try to select symbol and verify it's tradable                     |
//+------------------------------------------------------------------+
bool TrySymbol(string sym)
{
   if(!SymbolSelect(sym, true))
      return false;
   return (SymbolInfoDouble(sym, SYMBOL_BID) > 0);
}

//+------------------------------------------------------------------+
//| Add resolved pair->symbol to cache                                |
//+------------------------------------------------------------------+
void CacheAdd(string pair, string symbol)
{
   if(g_cacheCount >= 20)
      return;
   g_cachedSymbol[0][g_cacheCount] = pair;
   g_cachedSymbol[1][g_cacheCount] = symbol;
   g_cacheCount++;
   Print("[FindSymbol] ", pair, " -> ", symbol);
}

//+------------------------------------------------------------------+
//| Extract a JSON value by key - returns string (empty if not found) |
//+------------------------------------------------------------------+
string JsonExtract(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start < 0)
      return "";

   start += StringLen(search);

   // Skip whitespace
   while(start < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, start);
      if(ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r')
         break;
      start++;
   }

   // String value: "..."
   if(StringGetCharacter(json, start) == '"')
   {
      start++;
      int end = start;
      while(end < StringLen(json) && StringGetCharacter(json, end) != '"')
         end++;
      return StringSubstr(json, start, end - start);
   }

   // Null value
   if(StringFind(json, "null", start) == start)
      return "";

   // Numeric value
   int end = start;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\n' || ch == '\r')
         break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Fetch signal from API                                            |
//+------------------------------------------------------------------+
bool FetchSignal(string &json)
{
   char   data[];  // Empty for GET
   char   result[];
   string resultHeaders;
   string headers = "X-MT5-Key: " + API_KEY + "\r\n"
                  + "Accept: application/json\r\n";

   int res = WebRequest("GET", API_URL, headers, 5000, data, result, resultHeaders);

   if(res != 200)
   {
      Print("[SignalReceiver] WebRequest error: HTTP ", res);
      // 403 = invalid key, 500 = server error
      if(res == 403)
         Print("[SignalReceiver] Check MT5_API_KEY in Inputs matches server .env");
      return false;
   }

   json = CharArrayToString(result);
   return true;
}

//+------------------------------------------------------------------+
//| Check if position already exists for this signal                  |
//+------------------------------------------------------------------+
bool PositionExists(int signalId)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionSelectByTicket(PositionGetTicket(i)))
      {
         if(PositionGetInteger(POSITION_MAGIC) == MAGIC_NUMBER)
         {
            string comment = PositionGetString(POSITION_COMMENT);
            string idStr = IntegerToString(signalId);
            if(StringFind(comment, idStr) >= 0)
               return true;
         }
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Execute trade based on signal                                     |
//+------------------------------------------------------------------+
bool ExecuteTrade(string pair, string direction, double entry, double tp, double sl, int signalId)
{
   string symbol = FindSymbol(pair);
   if(symbol == "")
   {
      Print("[SignalReceiver] Symbol not found for: ", pair);
      return false;
   }

   double ask     = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid     = SymbolInfoDouble(symbol, SYMBOL_BID);
   double point   = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int    digits  = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   int    stopLvl = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double stopDist = stopLvl * point;

   // Validate prices
   if(entry <= 0)
      entry = (direction == "BUY") ? ask : bid;

   ENUM_ORDER_TYPE orderType;
   double price, slPrice, tpPrice;

   if(direction == "BUY")
   {
      orderType = ORDER_TYPE_BUY;
      price     = NormalizeDouble(ask, digits);

      // MT5 validates: SL < BID (SL executes as SELL at BID)
      if(sl > 0)
      {
         slPrice = NormalizeDouble(sl, digits);
         double minSL = NormalizeDouble(bid - stopDist * 2, digits);
         if(slPrice > minSL)
         {
            Print("[SignalReceiver] BUY SL too close (SL=", slPrice, " min=", minSL, " stopLvl=", stopLvl, "pts), adjusting...");
            slPrice = minSL;
         }
      }
      else slPrice = 0;

      // MT5 validates: TP > ASK (TP executes as SELL at BID, need buffer above ASK)
      if(tp > 0)
      {
         tpPrice = NormalizeDouble(tp, digits);
         double minTP = NormalizeDouble(bid + stopDist * 2, digits);
         if(tpPrice < minTP)
         {
            Print("[SignalReceiver] BUY TP too close or behind (TP=", tpPrice, " min=", minTP, "). Skipping TP...");
            tpPrice = 0;
         }
      }
      else tpPrice = 0;
   }
   else if(direction == "SELL")
   {
      orderType = ORDER_TYPE_SELL;
      price     = NormalizeDouble(bid, digits);

      // MT5 validates: SL > ASK (SL executes as BUY at ASK)
      if(sl > 0)
      {
         slPrice = NormalizeDouble(sl, digits);
         double maxSL = NormalizeDouble(ask + stopDist * 2, digits);
         if(slPrice < maxSL)
         {
            Print("[SignalReceiver] SELL SL too close (SL=", slPrice, " max=", maxSL, " stopLvl=", stopLvl, "pts), adjusting...");
            slPrice = maxSL;
         }
      }
      else slPrice = 0;

      // MT5 validates: TP < BID (TP executes as BUY at ASK, need buffer below BID)
      if(tp > 0)
      {
         tpPrice = NormalizeDouble(tp, digits);
         double maxTP = NormalizeDouble(ask - stopDist * 2, digits);
         if(tpPrice > maxTP)
         {
            Print("[SignalReceiver] SELL TP too close or behind (TP=", tpPrice, " max=", maxTP, "). Skipping TP...");
            tpPrice = 0;
         }
      }
      else tpPrice = 0;
   }
   else
   {
      Print("[SignalReceiver] Invalid direction: ", direction);
      return false;
   }

   // Lot size calculation
   double lotSize = LOT_SIZE;

   if(USE_RISK_PCT && sl > 0)
   {
      double riskMoney  = AccountInfoDouble(ACCOUNT_BALANCE) * RISK_PERCENT / 100.0;
      double slPoints   = MathAbs(price - sl) / point;
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

   // Debug: print exact order details
   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] SENDING ORDER:");
   Print("  Symbol   : ", symbol, " (digits=", digits, " point=", point, " stopLvl=", stopLvl, ")");
   Print("  Type     : ", (orderType == ORDER_TYPE_BUY ? "BUY" : "SELL"));
   Print("  Price    : ", price, " (Ask=", ask, " Bid=", bid, ")");
   Print("  SL       : ", slPrice, " (raw=", sl, ")");
   Print("  TP       : ", tpPrice, " (raw=", tp, ")");
   Print("  Lot      : ", lotSize);
   Print("  Magic    : ", MAGIC_NUMBER);
   Print("══════════════════════════════════════════════");

   // Prepare trade request
   MqlTradeRequest request  = {};
   MqlTradeResult  result   = {};

   request.action    = TRADE_ACTION_DEAL;
   request.symbol    = symbol;
   request.volume    = lotSize;
   request.type      = orderType;
   request.price     = price;
   request.sl        = slPrice;
   request.tp        = tpPrice;
   request.deviation = SLIPPAGE;
   request.magic     = MAGIC_NUMBER;
   request.comment   = "ATH #" + IntegerToString(signalId);
   request.type_filling = ORDER_FILLING_FOK;

   // Try FOK first, fallback to IOC
   if(!OrderSend(request, result))
   {
      request.type_filling = ORDER_FILLING_IOC;
      if(!OrderSend(request, result))
      {
         Print("[SignalReceiver] OrderSend failed. RetCode=", result.retcode, " ", result.comment);
         return false;
      }
   }

   Print("[SignalReceiver] TRADE OPENED | ",
         symbol, " ", direction,
         " | Lot=", lotSize,
         " | Entry=", price,
         " | SL=", slPrice,
         " | TP=", tpPrice,
         " | Ticket=", result.order);
   return true;
}

//+------------------------------------------------------------------+
//| Process incoming signal from API                                   |
//+------------------------------------------------------------------+
void ProcessSignal()
{
   if(g_isBusy)
      return;

   g_isBusy = true;

   string json;
   if(!FetchSignal(json))
   {
      g_isBusy = false;
      return;
   }

   // No active signal
   if(json == "null" || StringFind(json, "\"error\"") >= 0)
   {
      if(StringFind(json, "\"error\"") >= 0)
         Print("[SignalReceiver] API error: ", json);
      g_isBusy = false;
      return;
   }

   // Parse signal fields
   int    signalId  = (int)StringToInteger(JsonExtract(json, "id"));
   string pair      = JsonExtract(json, "pair");
   string direction = JsonExtract(json, "direction");
   double entry     = StringToDouble(JsonExtract(json, "entry"));
   double tp1       = StringToDouble(JsonExtract(json, "tp1"));
   double tp2       = StringToDouble(JsonExtract(json, "tp2"));
   double tp3       = StringToDouble(JsonExtract(json, "tp3"));
   double sl        = StringToDouble(JsonExtract(json, "sl"));
   string reason    = JsonExtract(json, "reason");

   if(signalId == 0 || pair == "" || direction == "")
   {
      Print("[SignalReceiver] Incomplete signal data received");
      g_isBusy = false;
      return;
   }

   // Skip already-processed signals
   if(signalId == g_lastSignalId)
   {
      g_isBusy = false;
      return;
   }

   // Skip if position already open for this signal ID
   if(PositionExists(signalId))
   {
      Print("[SignalReceiver] Position already exists for signal #", signalId);
      g_lastSignalId = signalId;
      g_isBusy = false;
      return;
   }

   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] NEW SIGNAL #", signalId);
   Print("  Pair     : ", pair, " (", FindSymbol(pair), ")");
   Print("  Direction: ", direction);
   Print("  Entry    : ", entry);
   Print("  TP1      : ", tp1);
   Print("  TP2      : ", tp2);
   Print("  TP3      : ", tp3);
   Print("  SL       : ", sl);
   Print("  Reason   : ", reason);

   // Select TP level
   double tp = 0;
   switch(TP_MODE)
   {
      case 1: tp = tp1; break;
      case 2: tp = tp2; break;
      case 3: tp = tp3; break;
   }

    // Execute trade (ExecuteTrade handles all SL/TP validation internally)
    if(ExecuteTrade(pair, direction, entry, tp, sl, signalId))
   {
      g_lastSignalId = signalId;
      g_lastPollTime = TimeCurrent();
   }

   g_isBusy = false;
}

//+------------------------------------------------------------------+
//| Expert initialization                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] EA Initialized");
   Print("  API URL : ", API_URL);
   Print("  Interval: ", POLL_INTERVAL, " seconds");
   Print("  Lot Size: ", LOT_SIZE);
   Print("  Magic   : ", MAGIC_NUMBER);
   Print("══════════════════════════════════════════════");
   Print("  IMPORTANT: Add URL to MT5 allowed list:");
   Print("  Tools -> Options -> Expert Advisors -> Allow WebRequest");
   Print("  Add: ", API_URL);

   EventSetTimer(POLL_INTERVAL);

   // Run first check immediately
   ProcessSignal();

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Timer event - polls API at interval                               |
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
   Print("[SignalReceiver] EA stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Chart event - press F5 for manual signal check                    |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long   &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_KEYDOWN)
   {
      // F5 = manual refresh
      if((int)lparam == 116)  // F5 key code
      {
         Print("[SignalReceiver] Manual signal check triggered (F5)");
         ProcessSignal();
      }
   }
}
