//+------------------------------------------------------------------+
//|                                                SignalReceiverATH.mq5 |
//|                                        ATH Trader - MT5 Integration |
//|          ดึง Signal จาก Server → เปิด Pending Order อัตโนมัติ         |
//|          MULTI-PAIR + Interactive Draggable Dashboard + State Save  |
//+------------------------------------------------------------------+
#property copyright "ATH Trader"
#property version   "3.1"
#property description "Multi-symbol Pending Order EA with Drag & Drop Dashboard"
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

//--- UI Customization Inputs
input string   UI_PREFIX        = "ATH_";       // Object name prefix
input color    PANEL_BG_COLOR   = C'20,24,35'; // Dashboard Background
input color    PANEL_BORDER     = C'45,55,72'; // Border line color
input int      INPUT_PANEL_Y    = 50;          // Default Y Position

//--- Global Variables
int       g_processedIds[50];
int       g_processedCount = 0;
bool      g_isBusy         = false;

//--- UI Position Variables
int       g_pX                = 30;
int       g_pY                = 50;
int       g_pWidth            = 520;
int       g_pHeight           = 240;
bool      g_isDragging        = false;
int       g_dragOffsetX       = 0;
int       g_dragOffsetY       = 0;
bool      g_isMinimized       = false;

//--- Symbol Cache
string    g_cachedSymbol[2][20];
int       g_cacheCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   ChartSetInteger(0, CHART_SHOW_GRID, false);
   ChartSetInteger(0, CHART_EVENT_MOUSE_MOVE, true);

   g_pY = INPUT_PANEL_Y;

   EventSetTimer(POLL_INTERVAL);
   CreateDashboard();
   LoadState();
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
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   DeleteDashboard();
}

//+------------------------------------------------------------------+
//| Chart event — handles drag, resize & hotkeys                      |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long   &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_KEYDOWN)
   {
      if((int)lparam == 116) { Print("[SignalReceiver] Manual signal check (F5)"); ProcessSignal(); }
      if((int)lparam == 117) { Print("[SignalReceiver] Manual cancel all pending (F6)"); CancelAllPending(); }
      return;
   }

   if(id == CHARTEVENT_MOUSE_MOVE)
   {
      int mouseX = (int)lparam;
      int mouseY = (int)dparam;
      uint mouseState = (uint)sparam;
      bool isLeftClickPressed = ((mouseState & 1) == 1);

      if(!isLeftClickPressed)
      {
         if(g_isDragging)
         {
            g_isDragging = false;
            ChartSetInteger(0, CHART_MOUSE_SCROLL, true);
         }
         return;
      }

      if(!g_isDragging && isLeftClickPressed)
      {
         if(mouseX >= g_pX && mouseX <= (g_pX + g_pWidth - 70) &&
            mouseY >= g_pY && mouseY <= (g_pY + 35))
         {
            g_isDragging = true;
            g_dragOffsetX = mouseX - g_pX;
            g_dragOffsetY = mouseY - g_pY;
            ChartSetInteger(0, CHART_MOUSE_SCROLL, false);
         }
      }

      if(g_isDragging)
      {
         g_pX = mouseX - g_dragOffsetX;
         g_pY = mouseY - g_dragOffsetY;
         if(g_pX < 0) g_pX = 0;
         if(g_pY < 0) g_pY = 0;
         CreateDashboard();
         return;
      }
   }

   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == UI_PREFIX + "BtnResize")
      {
         g_isMinimized = !g_isMinimized;
         ObjectSetInteger(0, UI_PREFIX + "BtnResize", OBJPROP_STATE, false);
         CreateDashboard();
         return;
      }
   }
}

//+------------------------------------------------------------------+
//| GUI DASHBOARD                                                     |
//+------------------------------------------------------------------+
void CreateDashboard()
{
   ObjectsDeleteAll(0, UI_PREFIX);

   int currentHeight = g_isMinimized ? 35 : g_pHeight;
   string resizeBtnText = g_isMinimized ? "🗖 Max" : "🗕 Min";

   CreatePanel("MainBackground", g_pX, g_pY, g_pWidth, currentHeight, PANEL_BG_COLOR, PANEL_BORDER);
   CreatePanel("HeaderBar", g_pX, g_pY, g_pWidth, 35, C'28,33,46', PANEL_BORDER);
   CreateButton("BtnResize", resizeBtnText, g_pX + g_pWidth - 65, g_pY + 5, 55, 24, "Segoe UI", 9, clrWhite, C'45,55,72');
   CreateLabel("Title", "ATH TRADER v3.1 — BOS + LIMIT", g_pX + 15, g_pY + 8, 11, C'0,230,255');

   if(g_isMinimized)
   {
      ChartRedraw(0);
      return;
   }

   CreatePanel("Divider", g_pX + 255, g_pY + 50, 2, 170, PANEL_BORDER, PANEL_BORDER);
   CreateLabel("Author", "MULTI-PAIR ENGINE", g_pX + 350, g_pY + 10, 8, C'115,128,142');

   int xLeft = g_pX + 15;
   CreateLabel("L_AutoTitle",    "Auto Trading:",    xLeft, g_pY + 55,  9, C'150,160,175');
   CreateLabel("L_PendingTitle",  "Pending Orders:",   xLeft, g_pY + 85,  9, C'150,160,175');
   CreateLabel("L_PositionTitle", "Active Positions:", xLeft, g_pY + 115, 9, C'150,160,175');
   CreateLabel("L_PairsTitle",    "Active Pairs:",     xLeft, g_pY + 145, 9, C'150,160,175');
   CreateLabel("L_TimeTitle",     "Last Update:",      xLeft, g_pY + 175, 9, C'150,160,175');
   CreateLabel("L_ShortcutHint",  "[F5] Refresh | [F6] Cancel All", xLeft, g_pY + 215, 8, C'90,100,115');

   int xRight = g_pX + 270;
   CreateLabel("R_LatestTitle",   "Latest Signal:",    xRight, g_pY + 55,  9, C'150,160,175');
   CreateLabel("R_PairTitle",     "Target Pair:",      xRight, g_pY + 85,  9, C'150,160,175');
   CreateLabel("R_EntryTitle",    "Entry Price:",      xRight, g_pY + 115, 9, C'150,160,175');
   CreateLabel("R_SlTitle",       "Stop Loss (SL):",   xRight, g_pY + 145, 9, C'150,160,175');
   CreateLabel("R_TpTitle",       "Target Pro (TP):",  xRight, g_pY + 175, 9, C'150,160,175');
   CreateLabel("R_StatusTitle",   "Engine Status:",    xRight, g_pY + 210, 8, C'115,128,142');

   CreateLabel("V_Auto",      "CHECKING...", xLeft+115, g_pY + 55,  9, clrWhite);
   CreateLabel("V_Pending",   "0",            xLeft+115, g_pY + 85,  9, clrWhite);
   CreateLabel("V_Position",  "0",            xLeft+115, g_pY + 115, 9, clrWhite);
   CreateLabel("V_Pairs",     "0",            xLeft+115, g_pY + 145, 9, clrWhite);
   CreateLabel("V_Time",      "Never",        xLeft+115, g_pY + 175, 9, clrWhite);

   CreateLabel("V_Latest",    "NONE",         xRight+115, g_pY + 55,  9, clrWhite);
   CreateLabel("V_Pair",      "WAITING...",   xRight+115, g_pY + 85,  11, clrWhite);
   CreateLabel("V_Entry",     "0.00000",      xRight+115, g_pY + 115, 9, clrWhite);
   CreateLabel("V_Sl",        "0.00000",      xRight+115, g_pY + 145, 9, clrWhite);
   CreateLabel("V_Tp",        "0.00000",      xRight+115, g_pY + 175, 9, clrWhite);
   CreateLabel("V_Status",    "STANDBY",      xRight+115, g_pY + 210, 8, clrWhite);

   UpdateDashboard();
}

void UpdateDashboard()
{
   if(g_isMinimized) return;

   int pendingCount = 0;
   int activePairs = 0;
   string pairsList = "";
   int total = OrdersTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == MAGIC_NUMBER)
      {
         ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
         if(orderType == ORDER_TYPE_BUY_LIMIT  ||
            orderType == ORDER_TYPE_SELL_LIMIT ||
            orderType == ORDER_TYPE_BUY_STOP   ||
            orderType == ORDER_TYPE_SELL_STOP)
         {
            pendingCount++;
            string sym = OrderGetString(ORDER_SYMBOL);
            if(StringFind(pairsList, sym) < 0)
            {
               if(pairsList != "") pairsList += ", ";
               pairsList += sym;
               activePairs++;
            }
         }
      }
   }
   int posCount = CountPositions();

   bool tradeAllowed = TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);
   bool algoAllowed  = MQLInfoInteger(MQL_TRADE_ALLOWED);
   color autoColor = (tradeAllowed && algoAllowed) ? C'50,220,100' : C'255,80,100';
   string autoTxt  = (tradeAllowed && algoAllowed) ? "ACTIVE" : "DISABLED";

   int latestSignalId = 0;
   string latestPair = "WAITING...";
   string latestDir = "-";
   double latestEntry = 0;
   double latestSl = 0;
   double latestTp = 0;

   int gvTotal = GlobalVariablesTotal();
   for(int i = 0; i < gvTotal; i++)
   {
      string name = GlobalVariableName(i);
      if(StringFind(name, "ATH_SignalId_") == 0)
      {
         int sid = (int)GlobalVariableGet(name);
         if(sid > latestSignalId)
         {
            latestSignalId = sid;
            latestPair = StringSubstr(name, 14);
            StringReplace(latestPair, "_", "/");
            double gvEntry = GlobalVariableGet(GvKey(latestPair, "Entry"));
            double gvSL = GlobalVariableGet(GvKey(latestPair, "SL"));
            double gvTP = GlobalVariableGet(GvKey(latestPair, "TP"));
            double gvDir = GlobalVariableGet(GvKey(latestPair, "Dir"));
            if(gvEntry > 0) latestEntry = gvEntry;
            if(gvSL > 0) latestSl = gvSL;
            if(gvTP > 0) latestTp = gvTP;
            if(gvDir == 1) latestDir = "BUY";
            else if(gvDir == 2) latestDir = "SELL";
         }
      }
   }

   color dirColor = clrWhite;
   if(latestDir == "BUY") dirColor = C'0,255,200';
   else if(latestDir == "SELL") dirColor = C'255,60,140';

   string timeStr = (g_isBusy) ? TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES) : "Idle";

   ObjectSetString(0, UI_PREFIX+"V_Auto", OBJPROP_TEXT, autoTxt);
   ObjectSetInteger(0, UI_PREFIX+"V_Auto", OBJPROP_COLOR, autoColor);
   ObjectSetString(0, UI_PREFIX+"V_Pending", OBJPROP_TEXT, IntegerToString(pendingCount));
   ObjectSetString(0, UI_PREFIX+"V_Position", OBJPROP_TEXT, IntegerToString(posCount));
   ObjectSetString(0, UI_PREFIX+"V_Pairs", OBJPROP_TEXT, IntegerToString(activePairs));
   ObjectSetString(0, UI_PREFIX+"V_Time", OBJPROP_TEXT, timeStr);

   string sigTxt = (latestSignalId > 0) ? "#" + IntegerToString(latestSignalId) : "NO SIGNAL";
   ObjectSetString(0, UI_PREFIX+"V_Latest", OBJPROP_TEXT, sigTxt);
   ObjectSetString(0, UI_PREFIX+"V_Pair", OBJPROP_TEXT, latestPair);
   ObjectSetInteger(0, UI_PREFIX+"V_Pair", OBJPROP_COLOR, dirColor);
   ObjectSetString(0, UI_PREFIX+"V_Entry", OBJPROP_TEXT, DoubleToString(latestEntry, 5));
   ObjectSetString(0, UI_PREFIX+"V_Sl", OBJPROP_TEXT, DoubleToString(latestSl, 5));
   ObjectSetInteger(0, UI_PREFIX+"V_Sl", OBJPROP_COLOR, latestSl > 0 ? C'255,100,100' : clrWhite);
   ObjectSetString(0, UI_PREFIX+"V_Tp", OBJPROP_TEXT, DoubleToString(latestTp, 5));
   ObjectSetInteger(0, UI_PREFIX+"V_Tp", OBJPROP_COLOR, latestTp > 0 ? C'100,255,100' : clrWhite);
   ObjectSetString(0, UI_PREFIX+"V_Status", OBJPROP_TEXT, g_isBusy ? "PROCESSING..." : "STANDBY");

   ChartRedraw(0);
}

void DeleteDashboard()
{
   ObjectsDeleteAll(0, UI_PREFIX);
   ChartRedraw(0);
}

//--- UI Drawing Tools ---
void CreatePanel(string name, int x, int y, int width, int height, color bgColor, color borderColor)
{
   string objName = UI_PREFIX + name;
   ObjectCreate(0, objName, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, objName, OBJPROP_XSIZE, width);
   ObjectSetInteger(0, objName, OBJPROP_YSIZE, height);
   ObjectSetInteger(0, objName, OBJPROP_BGCOLOR, bgColor);
   ObjectSetInteger(0, objName, OBJPROP_BORDER_COLOR, borderColor);
   ObjectSetInteger(0, objName, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, objName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, objName, OBJPROP_BACK, false);
   ObjectSetInteger(0, objName, OBJPROP_ZORDER, 10);
}

void CreateLabel(string name, string text, int x, int y, int fontSize, color textColor, int anchor=ANCHOR_LEFT_UPPER)
{
   string objName = UI_PREFIX + name;
   ObjectCreate(0, objName, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, objName, OBJPROP_TEXT, text);
   ObjectSetString(0, objName, OBJPROP_FONT, "Segoe UI");
   ObjectSetInteger(0, objName, OBJPROP_FONTSIZE, fontSize);
   ObjectSetInteger(0, objName, OBJPROP_COLOR, textColor);
   ObjectSetInteger(0, objName, OBJPROP_ANCHOR, anchor);
   ObjectSetInteger(0, objName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, objName, OBJPROP_BACK, false);
   ObjectSetInteger(0, objName, OBJPROP_ZORDER, 20);
}

void CreateButton(string name, string text, int x, int y, int width, int height, string font, int fontSize, color txtColor, color bgColor)
{
   string objName = UI_PREFIX + name;
   ObjectCreate(0, objName, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, objName, OBJPROP_XSIZE, width);
   ObjectSetInteger(0, objName, OBJPROP_YSIZE, height);
   ObjectSetString(0, objName, OBJPROP_TEXT, text);
   ObjectSetString(0, objName, OBJPROP_FONT, font);
   ObjectSetInteger(0, objName, OBJPROP_FONTSIZE, fontSize);
   ObjectSetInteger(0, objName, OBJPROP_COLOR, txtColor);
   ObjectSetInteger(0, objName, OBJPROP_BGCOLOR, bgColor);
   ObjectSetInteger(0, objName, OBJPROP_BORDER_COLOR, PANEL_BORDER);
   ObjectSetInteger(0, objName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, objName, OBJPROP_STATE, false);
   ObjectSetInteger(0, objName, OBJPROP_ZORDER, 30);
}

//+------------------------------------------------------------------+
//| STATE PERSISTENCE VIA GLOBAL VARIABLES                             |
//+------------------------------------------------------------------+
string GvKey(string pair, string suffix)
{
   string key = pair;
   StringReplace(key, "/", "_");
   return "ATH_" + suffix + "_" + key;
}

void LoadState()
{
   int gvTotal = GlobalVariablesTotal();
   for(int i = gvTotal - 1; i >= 0; i--)
   {
      string name = GlobalVariableName(i);
      if(StringFind(name, "ATH_SignalId_") == 0)
      {
         string pair = StringSubstr(name, 14);
         StringReplace(pair, "_", "/");
         string symbol = FindSymbol(pair);
         if(symbol != "" && !HasPendingForSymbol(symbol))
         {
            Print("[SignalReceiver] Cleaning orphan state: ", pair, " (no pending order)");
            int gvCount = GlobalVariablesTotal();
            for(int j = 0; j < gvCount; j++)
            {
               string n = GlobalVariableName(j);
               if(StringFind(n, "ATH_") == 0 && StringFind(n, pair) >= 0)
                  GlobalVariableDel(n);
            }
         }
      }
   }
   Print("[SignalReceiver] State loaded.");
}

//+------------------------------------------------------------------+
//| Find real MT5 symbol name from API pair                           |
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
//| Fetch signal from API                                             |
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
   UpdateDashboard();
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
//| Check if there is a pending order for a specific symbol           |
//+------------------------------------------------------------------+
bool HasPendingForSymbol(string symbol)
{
   int total = OrdersTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == MAGIC_NUMBER)
      {
         if(OrderGetString(ORDER_SYMBOL) == symbol)
         {
            ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(orderType == ORDER_TYPE_BUY_LIMIT  ||
               orderType == ORDER_TYPE_SELL_LIMIT ||
               orderType == ORDER_TYPE_BUY_STOP   ||
               orderType == ORDER_TYPE_SELL_STOP)
               return true;
         }
      }
   }
   return false;
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
//| Check if today is weekend                                         |
//+------------------------------------------------------------------+
bool IsWeekend()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return (dt.day_of_week == 0 || dt.day_of_week == 6);
}

//+------------------------------------------------------------------+
//| Get appropriate filling mode for symbol                           |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE_FILLING GetFillingMode(string symbol)
{
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      return ORDER_FILLING_FOK;
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
}

//+------------------------------------------------------------------+
//| Place pending order (BOS Strategy — always LIMIT)                  |
//+------------------------------------------------------------------+
bool PlacePending(string symbol, string direction, double entry, double tp, double sl, int signalId)
{
   if(!SymbolSelect(symbol, true))
   {
      Print("[SignalReceiver] SymbolSelect FAILED: ", symbol);
      return false;
   }

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("[SignalReceiver] AutoTrading is DISABLED in terminal!");
      return false;
   }
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("[SignalReceiver] Live trading not allowed for this EA!");
      return false;
   }

   int tradeMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
   if(tradeMode == SYMBOL_TRADE_MODE_DISABLED)
   {
      Print("[SignalReceiver] Trading DISABLED for symbol: ", symbol);
      return false;
   }

   double ask    = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid    = SymbolInfoDouble(symbol, SYMBOL_BID);
   double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int    digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   int    stopLvl = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double stopDist = MathMax(stopLvl, 1) * point;

   if(ask <= 0 || bid <= 0 || point <= 0)
   {
      Print("[SignalReceiver] Invalid market data for ", symbol, " Ask=", ask, " Bid=", bid, " Point=", point);
      return false;
   }

   entry = NormalizeDouble(entry, digits);

   // BOS Strategy: Always use LIMIT orders
   // BUY LIMIT  = entry BELOW current Ask (price retraces to Order Block)
   // SELL LIMIT = entry ABOVE current Bid (price retraces to Order Block)
   ENUM_ORDER_TYPE orderType;
   double price = entry;

   if(direction == "BUY")
   {
      orderType = ORDER_TYPE_BUY_LIMIT;
      if(entry >= ask)
      {
         price = NormalizeDouble(ask - stopDist - point, digits);
         Print("[SignalReceiver] BUY entry above Ask — adjusted for BUY LIMIT: ", entry, " -> ", price);
      }
      else if(entry >= bid - stopDist)
      {
         price = NormalizeDouble(bid - stopDist - point, digits);
         Print("[SignalReceiver] BUY LIMIT entry adjusted: ", entry, " -> ", price, " (too close to Bid)");
      }
   }
   else // SELL
   {
      orderType = ORDER_TYPE_SELL_LIMIT;
      if(entry <= bid)
      {
         price = NormalizeDouble(bid + stopDist + point, digits);
         Print("[SignalReceiver] SELL entry below Bid — adjusted for SELL LIMIT: ", entry, " -> ", price);
      }
      else if(entry <= ask + stopDist)
      {
         price = NormalizeDouble(ask + stopDist + point, digits);
         Print("[SignalReceiver] SELL LIMIT entry adjusted: ", entry, " -> ", price, " (too close to Ask)");
      }
   }

   double slPrice = 0, tpPrice = 0;

   if(sl > 0)
   {
      slPrice = NormalizeDouble(sl, digits);
      if(direction == "BUY" && slPrice >= price)
      {
         slPrice = NormalizeDouble(price - stopDist * 10, digits);
         Print("[SignalReceiver] BUY SL adjusted below entry: ", slPrice);
      }
      else if(direction == "SELL" && slPrice <= price)
      {
         slPrice = NormalizeDouble(price + stopDist * 10, digits);
         Print("[SignalReceiver] SELL SL adjusted above entry: ", slPrice);
      }
   }

   if(tp > 0)
   {
      tpPrice = NormalizeDouble(tp, digits);
      if(direction == "BUY" && tpPrice <= price)
      {
         tpPrice = NormalizeDouble(price + stopDist * 10, digits);
         Print("[SignalReceiver] BUY TP adjusted above entry: ", tpPrice);
      }
      else if(direction == "SELL" && tpPrice >= price)
      {
         tpPrice = NormalizeDouble(price - stopDist * 10, digits);
         Print("[SignalReceiver] SELL TP adjusted below entry: ", tpPrice);
      }
   }

   double lotSize = LOT_SIZE;
   if(USE_RISK_PCT && sl > 0)
   {
      double riskMoney = AccountInfoDouble(ACCOUNT_BALANCE) * RISK_PERCENT / 100.0;
      double slPoints  = MathAbs(price - sl) / point;
      if(slPoints > 0)
      {
         double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
         if(tickValue > 0)
         {
            lotSize = NormalizeDouble(riskMoney / (slPoints * tickValue), 2);
            double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
            double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
            double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
            if(lotSize < minLot) lotSize = minLot;
            if(lotSize > maxLot) lotSize = maxLot;
            if(lotStep > 0)
               lotSize = NormalizeDouble(MathFloor(lotSize / lotStep) * lotStep, 2);
         }
      }
   }
   lotSize = NormalizeDouble(lotSize, 2);

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
   Print("  Entry    : ", price, " (orig=", entry, " Ask=", ask, " Bid=", bid, ")");
   Print("  SL       : ", slPrice);
   Print("  TP       : ", tpPrice);
   Print("  Lot      : ", lotSize);
   Print("  Signal   : #", signalId);
   Print("  Filling  : ", EnumToString(GetFillingMode(symbol)));
   Print("══════════════════════════════════════════════");

   MqlTradeRequest request  = {};
   MqlTradeResult  result   = {};

   request.action       = TRADE_ACTION_PENDING;
   request.symbol       = symbol;
   request.volume       = lotSize;
   request.type         = orderType;
   request.price        = price;
   request.sl           = slPrice;
   request.tp           = tpPrice;
   request.magic        = MAGIC_NUMBER;
   request.comment      = "ATH #" + IntegerToString(signalId);
   request.type_filling = GetFillingMode(symbol);
   request.deviation    = SLIPPAGE;

   if(OrderSend(request, result))
   {
      Print("[SignalReceiver] PENDING ORDER PLACED | Ticket=", result.order);
      return true;
   }
   else
   {
      int err = GetLastError();
      Print("[SignalReceiver] Pending order FAILED | RetCode=", result.retcode,
            " LastError=", err, " ", result.comment);
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
   string hasSetupStr = JsonExtract(obj, "hasSetup");
   if(hasSetupStr == "false")
   {
      Print("[SignalReceiver] AI Analysis: No valid setup — skipping");
      return;
   }

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

   if(IsProcessed(signalId))
      return;

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

   string symbol = FindSymbol(pair);
   if(symbol == "")
   {
      Print("[SignalReceiver] Symbol not found for: ", pair);
      return;
   }

   if(SymbolInfoDouble(symbol, SYMBOL_BID) <= 0 || SymbolInfoDouble(symbol, SYMBOL_ASK) <= 0)
   {
      Print("[SignalReceiver] No market prices for ", symbol, " — skipping");
      return;
   }

   int tradeMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
   if(tradeMode == SYMBOL_TRADE_MODE_DISABLED)
   {
      Print("[SignalReceiver] Skipped ", pair, " (market closed by broker)");
      return;
   }

   if(IsWeekend() && (category == "forex" || category == "commodities"))
   {
      Print("[SignalReceiver] Skipped ", pair, " (", category, " market closed on weekend)");
      return;
   }

   // State persistence: skip if already processed for this pair
   string gvSignalId = GvKey(pair, "SignalId");
   int lastIdForPair = (int)GlobalVariableGet(gvSignalId);
   if(lastIdForPair < 0) lastIdForPair = 0;

   if(signalId == lastIdForPair && HasPendingForSymbol(symbol))
   {
      Print("[SignalReceiver] Signal #", signalId, " for ", pair, " already processed and pending active");
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

   double tp = 0;
   switch(TP_MODE)
   {
      case 1: tp = tp1; break;
      case 2: tp = tp2; break;
      case 3: tp = tp3; break;
   }

   if(HasPendingForSymbol(symbol))
   {
      Print("[SignalReceiver] ", pair, " already has pending order — cancelling before placing new");
      CancelPendingBySymbol(symbol);
   }

   if(PlacePending(symbol, direction, entry, tp, sl, signalId))
   {
      MarkProcessed(signalId);
      GlobalVariableSet(gvSignalId, signalId);
      GlobalVariableSet(GvKey(pair, "Entry"), entry);
      GlobalVariableSet(GvKey(pair, "SL"), sl);
      GlobalVariableSet(GvKey(pair, "TP"), tp);
      GlobalVariableSet(GvKey(pair, "Dir"), (direction=="BUY" ? 1 : 2));
   }
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
      UpdateDashboard();
      return;
   }

   if(json == "[]" || json == "null" || StringFind(json, "\"error\"") >= 0)
   {
      g_isBusy = false;
      UpdateDashboard();
      return;
   }

   int pos = 0;
   while(pos < StringLen(json))
   {
      int start = StringFind(json, "{", pos);
      if(start < 0) break;

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
   UpdateDashboard();
}
