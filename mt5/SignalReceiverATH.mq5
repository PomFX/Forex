//+------------------------------------------------------------------+
//|                                                SignalReceiverATH.mq5 |
//|                                        ATH Trader - MT5 Integration |
//| Online  : ดึง Signal จาก API → เปิด Pending Order                  |
//| Offline : Scan BOS + Order Block → วาง Limit Order อัตโนมัติ        |
//| Toggle Mode จาก Dashboard                                          |
//+------------------------------------------------------------------+
#property copyright "ATH Trader"
#property version   "4.1"
#property description "Online/Offline BOS + Order Block EA + Account Monitor"
#property description "Docs: https://forex-rouge-gamma.vercel.app"

//--- Input Parameters
input string   API_URL            = "https://forex-rouge-gamma.vercel.app/api/signals/mt5";
input string   API_KEY            = "d0d52fa0d8070ec18b99375dd25baa5b46338653dd5ea7c8";
input double   LOT_SIZE           = 0.01;        // Fixed lot size
input int      POLL_INTERVAL      = 60;          // Poll interval (seconds)
input int      MAGIC_NUMBER       = 20260605;    // Magic number
input int      SLIPPAGE           = 30;          // Max slippage when order fills (points)
input bool     USE_RISK_PCT       = false;       // Use risk-based lot sizing
input double   RISK_PERCENT       = 1.0;         // Risk % per trade
input int      TP_MODE            = 1;           // 1=TP1, 2=TP2, 3=TP3
input int      MODE_SELECT        = 0;           // 0=Online (API), 1=Offline (BOS Scan)
input bool     FILTER_COMMODITIES = true;        // รับ Signal Commodities
input bool     FILTER_FOREX       = true;        // รับ Signal Forex
input bool     FILTER_CRYPTO      = true;        // รับ Signal Crypto

//--- Offline BOS Parameters
input int      BOS_LOOKBACK       = 5;           // Bars for swing point detection
input int      BOS_SCAN_BARS      = 100;         // Bars to scan for swings
input double   BOS_RISK_RR1       = 2.0;         // R:R สำหรับ TP1
input double   BOS_RISK_RR2       = 3.0;         // R:R สำหรับ TP2
input double   BOS_RISK_RR3       = 5.0;         // R:R สำหรับ TP3
input int      BOS_MAX_PER_DAY    = 4;           // Max signals/day (offline)

//--- UI Customization Inputs
input string   UI_PREFIX          = "ATH_";
input color    PANEL_BG_COLOR     = C'20,24,35';
input color    PANEL_BORDER       = C'45,55,72';
input int      INPUT_PANEL_X      = 30;          // Dashboard X Position
input int      INPUT_PANEL_Y      = 50;          // Dashboard Y Position
input int      INPUT_PANEL_W      = 520;         // Dashboard Width
input int      INPUT_PANEL_H      = 240;         // Dashboard Height

//--- Global Variables
int       g_processedIds[50];
int       g_processedCount = 0;
bool      g_isBusy         = false;
int       g_mode           = 0;          // 0=Online, 1=Offline
int       g_offlineCount   = 0;          // Offline signals today
string    g_modeStr;

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

//--- Account Monitoring
int       g_heartbeatTick = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   ChartSetInteger(0, CHART_SHOW_GRID, false);
   ChartSetInteger(0, CHART_EVENT_MOUSE_MOVE, true);

   g_pX = INPUT_PANEL_X;
   g_pY = INPUT_PANEL_Y;
   g_pWidth = INPUT_PANEL_W;
   g_pHeight = INPUT_PANEL_H;
   g_mode = MODE_SELECT;

   EventSetTimer(POLL_INTERVAL);
   CreateDashboard();
   LoadState();

   if(g_mode == 0)
      ProcessSignal();
   else
      RunOfflineBOS();

   // Send initial account info
   SendAccountInfo();
   g_heartbeatTick = 0;

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Timer event                                                       |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Send account heartbeat every 5 ticks (5 min if POLL_INTERVAL=60)
   g_heartbeatTick++;
   if(g_heartbeatTick >= 5)
   {
      g_heartbeatTick = 0;
      SendAccountInfo();
   }

   if(g_mode == 0)
      ProcessSignal();
   else
      RunOfflineBOS();
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
//| Chart event                                                       |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long   &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_KEYDOWN)
   {
      if((int)lparam == 116) { Print("[SignalReceiver] Manual refresh (F5)"); if(g_mode==0) ProcessSignal(); else RunOfflineBOS(); }
      if((int)lparam == 117) { Print("[SignalReceiver] Cancel all pending (F6)"); CancelAllPending(); }
      if((int)lparam == 118) { ToggleMode(); } // F7
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
      if(sparam == UI_PREFIX + "BtnMode")
      {
         ToggleMode();
         ObjectSetInteger(0, UI_PREFIX + "BtnMode", OBJPROP_STATE, false);
         return;
      }
   }
}

void ToggleMode()
{
   g_mode = (g_mode == 0) ? 1 : 0;
   CreateDashboard();
   if(g_mode == 0)
   {
      Print("[SignalReceiver] Switched to ONLINE mode");
      ProcessSignal();
   }
   else
   {
      Print("[SignalReceiver] Switched to OFFLINE BOS SCAN mode");
      RunOfflineBOS();
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
   g_modeStr = (g_mode == 0) ? "ONLINE" : "OFFLINE BOS";

   CreatePanel("MainBackground", g_pX, g_pY, g_pWidth, currentHeight, PANEL_BG_COLOR, PANEL_BORDER);
   CreatePanel("HeaderBar", g_pX, g_pY, g_pWidth, 35, C'28,33,46', PANEL_BORDER);
   CreateButton("BtnResize", resizeBtnText, g_pX + g_pWidth - 65, g_pY + 5, 55, 24, "Segoe UI", 9, clrWhite, C'45,55,72');

   string modeBtnColor = (g_mode == 0) ? "0,200,255" : "255,180,50";
   string modeLabel = (g_mode == 0) ? "🔵 Online" : "🟠 Offline";
   CreateButton("BtnMode", modeLabel, g_pX + g_pWidth - 130, g_pY + 5, 60, 24, "Segoe UI", 8, clrWhite, C'35,45,60');

   CreateLabel("Title", "ATH TRADER v4.1 — " + g_modeStr, g_pX + 15, g_pY + 8, 11, C'0,230,255');

   if(g_isMinimized)
   {
      ChartRedraw(0);
      return;
   }

   CreatePanel("Divider", g_pX + 255, g_pY + 50, 2, 170, PANEL_BORDER, PANEL_BORDER);
   CreateLabel("Author", "BOS + LIMIT ENGINE", g_pX + 350, g_pY + 10, 8, C'115,128,142');

   int xLeft = g_pX + 15;
   CreateLabel("L_AutoTitle",    "Auto Trading:",    xLeft, g_pY + 55,  9, C'150,160,175');
   CreateLabel("L_PendingTitle",  "Pending Orders:",   xLeft, g_pY + 85,  9, C'150,160,175');
   CreateLabel("L_PositionTitle", "Active Positions:", xLeft, g_pY + 115, 9, C'150,160,175');
   CreateLabel("L_PairsTitle",    "Active Pairs:",     xLeft, g_pY + 145, 9, C'150,160,175');
   CreateLabel("L_TimeTitle",     "Last Update:",      xLeft, g_pY + 175, 9, C'150,160,175');
   CreateLabel("L_ShortcutHint",  "[F5] Refresh | [F6] Cancel All | [F7] Toggle", xLeft, g_pY + 215, 8, C'90,100,115');

   int xRight = g_pX + 270;
   CreateLabel("R_LatestTitle",   "Latest Signal:",    xRight, g_pY + 55,  9, C'150,160,175');
   CreateLabel("R_PairTitle",     "Symbol:",           xRight, g_pY + 85,  9, C'150,160,175');
   CreateLabel("R_EntryTitle",    "Entry Price:",      xRight, g_pY + 115, 9, C'150,160,175');
   CreateLabel("R_SlTitle",       "Stop Loss (SL):",   xRight, g_pY + 145, 9, C'150,160,175');
   CreateLabel("R_TpTitle",       "Take Profit (TP):", xRight, g_pY + 175, 9, C'150,160,175');
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
//| STATE PERSISTENCE                                                 |
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
//| Symbol resolution                                                 |
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
//| Helpers                                                           |
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

bool IsWeekend()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return (dt.day_of_week == 0 || dt.day_of_week == 6);
}

ENUM_ORDER_TYPE_FILLING GetFillingMode(string symbol)
{
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK) return ORDER_FILLING_FOK;
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC) return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
}

//+------------------------------------------------------------------+
//| Place pending order (BOS — always LIMIT)                          |
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
   else
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
      case ORDER_TYPE_SELL_LIMIT: typeStr = "SELL LIMIT"; break;
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
      Print("[SignalReceiver] Pending order FAILED | RetCode=", result.retcode, " LastError=", err);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Order management                                                  |
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
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_LIMIT))
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
             OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_LIMIT))
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
            if(orderType == ORDER_TYPE_BUY_LIMIT || orderType == ORDER_TYPE_SELL_LIMIT)
               return true;
         }
      }
   }
   return false;
}

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
//| ONLINE MODE — Fetch from API                                     |
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
      return false;
   }

   if(res != 200)
   {
      Print("[SignalReceiver] WebRequest HTTP ", res);
      return false;
   }

   json = CharArrayToString(result);
   return true;
}

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

void ProcessOneSignal(string obj)
{
   string hasSetupStr = JsonExtract(obj, "hasSetup");
   if(hasSetupStr == "false")
   {
      Print("[SignalReceiver] AI: No valid setup");
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

   if(signalId == 0 || pair == "" || direction == "")
   {
      Print("[SignalReceiver] Incomplete signal — skipping");
      return;
   }

   if(IsProcessed(signalId)) return;

   string category = GetPairCategory(pair);
   bool allowed = (FILTER_COMMODITIES && category == "commodities") ||
                  (FILTER_FOREX && category == "forex") ||
                  (FILTER_CRYPTO && category == "crypto") ||
                  category == "unknown";
   if(!allowed) { Print("[SignalReceiver] Skipped ", pair, " (filter)"); return; }

   string symbol = FindSymbol(pair);
   if(symbol == "") { Print("[SignalReceiver] Symbol not found: ", pair); return; }
   if(SymbolInfoDouble(symbol, SYMBOL_BID) <= 0 || SymbolInfoDouble(symbol, SYMBOL_ASK) <= 0) return;

   int tradeMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
   if(tradeMode == SYMBOL_TRADE_MODE_DISABLED) return;
   if(IsWeekend() && (category == "forex" || category == "commodities")) return;

   string gvSignalId = GvKey(pair, "SignalId");
   int lastIdForPair = (int)GlobalVariableGet(gvSignalId);
   if(lastIdForPair < 0) lastIdForPair = 0;
   if(signalId == lastIdForPair && HasPendingForSymbol(symbol)) return;

   double tp = 0;
   switch(TP_MODE) { case 1: tp = tp1; break; case 2: tp = tp2; break; case 3: tp = tp3; break; }

   if(HasPendingForSymbol(symbol))
      CancelPendingBySymbol(symbol);

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

void ProcessSignal()
{
   if(g_isBusy) return;
   g_isBusy = true;
   Print("[SignalReceiver] ONLINE: Checking for new signals...");

   string json;
   if(!FetchSignal(json)) { g_isBusy = false; UpdateDashboard(); return; }
   if(json == "[]" || json == "null" || StringFind(json, "\"error\"") >= 0)
   { g_isBusy = false; UpdateDashboard(); return; }

   int pos = 0;
   while(pos < StringLen(json))
   {
      int start = StringFind(json, "{", pos);
      if(start < 0) break;
      int depth = 0; int end = start;
      for(int i = start; i < StringLen(json); i++)
      {
         ushort ch = StringGetCharacter(json, i);
         if(ch == '{') depth++; if(ch == '}') depth--;
         if(depth == 0) { end = i; break; }
      }
      string obj = StringSubstr(json, start, end - start + 1);
      pos = end + 1;
      ProcessOneSignal(obj);
   }

   g_isBusy = false;
   UpdateDashboard();
}

//+------------------------------------------------------------------+
//| OFFLINE MODE — BOS Scan on Chart Bars                             |
//+------------------------------------------------------------------+
void RunOfflineBOS()
{
   if(g_isBusy) return;
   g_isBusy = true;

   string symbol = Symbol();
   string pair = symbol;
   // Convert broker symbol to standard pair name for state tracking
   // We use the broker symbol directly for offline mode

   // Check category filter
   if(!SymbolFilterPass(pair))
   {
      g_isBusy = false;
      return;
   }

   // Check weekend
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(dt.day_of_week == 0 || dt.day_of_week == 6)
   {
      Print("[SignalReceiver] OFFLINE: Weekend — skipping");
      g_isBusy = false;
      return;
   }

   // Check trade mode
   int tradeMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
   if(tradeMode == SYMBOL_TRADE_MODE_DISABLED)
   {
      Print("[SignalReceiver] OFFLINE: Trading disabled for ", symbol);
      g_isBusy = false;
      return;
   }

   // Check daily limit
   int todaySignals = CountTodaySignals();
   if(todaySignals >= BOS_MAX_PER_DAY)
   {
      Print("[SignalReceiver] OFFLINE: Daily limit reached (", todaySignals, "/", BOS_MAX_PER_DAY, ")");
      g_isBusy = false;
      UpdateDashboard();
      return;
   }

   // Check if already have pending for this symbol
   if(HasPendingForSymbol(symbol))
   {
      Print("[SignalReceiver] OFFLINE: ", symbol, " already has pending order");
      g_isBusy = false;
      UpdateDashboard();
      return;
   }

   Print("[SignalReceiver] OFFLINE: Scanning ", symbol, " for BOS...");

   // Find swing points
   double swingHighs[], swingLows[];
   int swingHighBars[], swingLowBars[];
   FindSwingPoints(swingHighs, swingLows, swingHighBars, swingLowBars);

   if(ArraySize(swingHighs) < 1 && ArraySize(swingLows) < 1)
   {
      Print("[SignalReceiver] OFFLINE: Not enough swing points");
      g_isBusy = false;
      return;
   }

   // Check latest 2 bars for BOS
   int totalBars = BOS_SCAN_BARS;
   if(totalBars > Bars(symbol, PERIOD_CURRENT) - 1)
      totalBars = Bars(symbol, PERIOD_CURRENT) - 1;

   double close1 = iClose(symbol, PERIOD_CURRENT, 1); // Last completed bar
   double close0 = iClose(symbol, PERIOD_CURRENT, 0); // Current forming bar

   // Find the most recent swing highs and lows (within last 20 bars)
   int lastSwingHighBar = -1, lastSwingLowBar = -1;
   double lastSwingHigh = 0, lastSwingLow = 0;

   for(int i = 0; i < ArraySize(swingHighs); i++)
   {
      if(swingHighBars[i] < 20 && swingHighs[i] > lastSwingHigh)
      {
         lastSwingHigh = swingHighs[i];
         lastSwingHighBar = swingHighBars[i];
      }
   }
   for(int i = 0; i < ArraySize(swingLows); i++)
   {
      if(swingLowBars[i] < 20 && (swingLows[i] < lastSwingLow || lastSwingLow == 0))
      {
         lastSwingLow = swingLows[i];
         lastSwingLowBar = swingLowBars[i];
      }
   }

   // Try Bullish BOS first
   if(close1 > lastSwingHigh && lastSwingHigh > 0)
   {
      Print("[SignalReceiver] OFFLINE: Bullish BOS detected — close (", close1, ") > last HH (", lastSwingHigh, ")");
      FindAndPlaceBuyBOS(symbol, lastSwingHighBar, close1);
      g_isBusy = false;
      UpdateDashboard();
      return;
   }

   // Try Bearish BOS
   if(close1 < lastSwingLow && lastSwingLow > 0)
   {
      Print("[SignalReceiver] OFFLINE: Bearish BOS detected — close (", close1, ") < last LL (", lastSwingLow, ")");
      FindAndPlaceSellBOS(symbol, lastSwingLowBar, close1);
      g_isBusy = false;
      UpdateDashboard();
      return;
   }

   Print("[SignalReceiver] OFFLINE: No BOS detected on ", symbol);
   g_isBusy = false;
   UpdateDashboard();
}

bool SymbolFilterPass(string symbol)
{
   string cat = "unknown";
   if(StringFind(symbol, "XAU") >= 0 || StringFind(symbol, "XAG") >= 0 ||
      StringFind(symbol, "GOLD") >= 0) cat = "commodities";
   else if(StringFind(symbol, "EUR") >= 0 || StringFind(symbol, "GBP") >= 0 ||
           StringFind(symbol, "JPY") >= 0 || StringFind(symbol, "CHF") >= 0 ||
           StringFind(symbol, "AUD") >= 0 || StringFind(symbol, "NZD") >= 0 ||
           StringFind(symbol, "CAD") >= 0) cat = "forex";
   else if(StringFind(symbol, "BTC") >= 0 || StringFind(symbol, "ETH") >= 0 ||
           StringFind(symbol, "XRP") >= 0) cat = "crypto";

   return (FILTER_COMMODITIES && cat == "commodities") ||
          (FILTER_FOREX && cat == "forex") ||
          (FILTER_CRYPTO && cat == "crypto");
}

int FindSwingPoints(double &highs[], double &lows[], int &highBars[], int &lowBars[])
{
   ArrayResize(highs, 50); ArrayResize(lows, 50);
   ArrayResize(highBars, 50); ArrayResize(lowBars, 50);
   int hCount = 0, lCount = 0;

   int totalBars = BOS_SCAN_BARS;
   if(totalBars > Bars(Symbol(), PERIOD_CURRENT) - 3)
      totalBars = Bars(Symbol(), PERIOD_CURRENT) - 3;

   for(int i = BOS_LOOKBACK; i < totalBars - BOS_LOOKBACK; i++)
   {
      bool isHigh = true;
      bool isLow = true;
      for(int j = 1; j <= BOS_LOOKBACK; j++)
      {
         if(iHigh(Symbol(), PERIOD_CURRENT, i) <= iHigh(Symbol(), PERIOD_CURRENT, i - j) ||
            iHigh(Symbol(), PERIOD_CURRENT, i) <= iHigh(Symbol(), PERIOD_CURRENT, i + j))
            isHigh = false;
         if(iLow(Symbol(), PERIOD_CURRENT, i) >= iLow(Symbol(), PERIOD_CURRENT, i - j) ||
            iLow(Symbol(), PERIOD_CURRENT, i) >= iLow(Symbol(), PERIOD_CURRENT, i + j))
            isLow = false;
      }

      if(isHigh)
      {
         highs[hCount] = iHigh(Symbol(), PERIOD_CURRENT, i);
         highBars[hCount] = i;
         if(hCount < 49) hCount++;
      }
      if(isLow)
      {
         lows[lCount] = iLow(Symbol(), PERIOD_CURRENT, i);
         lowBars[lCount] = i;
         if(lCount < 49) lCount++;
      }
   }

   // Merge into one array format
   ArrayResize(highs, hCount);
   ArrayResize(highBars, hCount);
   ArrayResize(lows, lCount);
   ArrayResize(lowBars, lCount);

   return hCount + lCount;
}

void FindAndPlaceBuyBOS(string symbol, int swingHighBar, double closePrice)
{
   // Find Order Block: last bearish candle (close < open) before the breakout candle
   // The breakout candle is the bar that closed above swingHighBar's high
   int breakoutBar = -1;
   for(int i = swingHighBar - 1; i >= 1; i--)
   {
      if(iClose(symbol, PERIOD_CURRENT, i) > iHigh(symbol, PERIOD_CURRENT, swingHighBar))
      {
         breakoutBar = i;
         break;
      }
   }

   if(breakoutBar < 1) breakoutBar = 1;

   // Find the last bearish candle before breakout (Order Block)
   int obBar = -1;
   for(int i = breakoutBar + 1; i < BOS_SCAN_BARS; i++)
   {
      if(iClose(symbol, PERIOD_CURRENT, i) < iOpen(symbol, PERIOD_CURRENT, i))
      {
         obBar = i;
         break;
      }
   }

   if(obBar < 0)
   {
      Print("[SignalReceiver] OFFLINE: No Order Block found for Bullish BOS");
      return;
   }

   double entry  = iLow(symbol, PERIOD_CURRENT, obBar);
   double sl     = entry - (iHigh(symbol, PERIOD_CURRENT, obBar) - iLow(symbol, PERIOD_CURRENT, obBar)) * 0.3;
   double risk   = entry - sl;
   double tp1    = entry + risk * BOS_RISK_RR1;
   double tp2    = entry + risk * BOS_RISK_RR2;
   double tp3    = entry + risk * BOS_RISK_RR3;

   if(risk <= 0)
   {
      Print("[SignalReceiver] OFFLINE: Invalid risk for BOS Buy");
      return;
   }

   int signalId = GenerateSignalId();

   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] OFFLINE BOS BUY SETUP:");
   Print("  Symbol   : ", symbol);
   Print("  Entry    : ", entry, " (OB Low bar ", obBar, ")");
   Print("  SL       : ", sl);
   Print("  TP1/2/3  : ", tp1, " / ", tp2, " / ", tp3);
   Print("  R:R      : 1:", BOS_RISK_RR1, " / 1:", BOS_RISK_RR2, " / 1:", BOS_RISK_RR3);
   Print("══════════════════════════════════════════════");

   double tp = 0;
   switch(TP_MODE) { case 1: tp = tp1; break; case 2: tp = tp2; break; case 3: tp = tp3; break; }

   if(PlacePending(symbol, "BUY", entry, tp, sl, signalId))
   {
      string pair = symbol;
      GlobalVariableSet(GvKey(pair, "Entry"), entry);
      GlobalVariableSet(GvKey(pair, "SL"), sl);
      GlobalVariableSet(GvKey(pair, "TP"), tp);
      GlobalVariableSet(GvKey(pair, "Dir"), 1);
   }
}

void FindAndPlaceSellBOS(string symbol, int swingLowBar, double closePrice)
{
   // Find Order Block: last bullish candle (close > open) before the breakout candle
   int breakoutBar = -1;
   for(int i = swingLowBar - 1; i >= 1; i--)
   {
      if(iClose(symbol, PERIOD_CURRENT, i) < iLow(symbol, PERIOD_CURRENT, swingLowBar))
      {
         breakoutBar = i;
         break;
      }
   }

   if(breakoutBar < 1) breakoutBar = 1;

   int obBar = -1;
   for(int i = breakoutBar + 1; i < BOS_SCAN_BARS; i++)
   {
      if(iClose(symbol, PERIOD_CURRENT, i) > iOpen(symbol, PERIOD_CURRENT, i))
      {
         obBar = i;
         break;
      }
   }

   if(obBar < 0)
   {
      Print("[SignalReceiver] OFFLINE: No Order Block found for Bearish BOS");
      return;
   }

   double entry  = iHigh(symbol, PERIOD_CURRENT, obBar);
   double sl     = entry + (iHigh(symbol, PERIOD_CURRENT, obBar) - iLow(symbol, PERIOD_CURRENT, obBar)) * 0.3;
   double risk   = sl - entry;
   double tp1    = entry - risk * BOS_RISK_RR1;
   double tp2    = entry - risk * BOS_RISK_RR2;
   double tp3    = entry - risk * BOS_RISK_RR3;

   if(risk <= 0)
   {
      Print("[SignalReceiver] OFFLINE: Invalid risk for BOS Sell");
      return;
   }

   int signalId = GenerateSignalId();

   Print("══════════════════════════════════════════════");
   Print("[SignalReceiver] OFFLINE BOS SELL SETUP:");
   Print("  Symbol   : ", symbol);
   Print("  Entry    : ", entry, " (OB High bar ", obBar, ")");
   Print("  SL       : ", sl);
   Print("  TP1/2/3  : ", tp1, " / ", tp2, " / ", tp3);
   Print("  R:R      : 1:", BOS_RISK_RR1, " / 1:", BOS_RISK_RR2, " / 1:", BOS_RISK_RR3);
   Print("══════════════════════════════════════════════");

   double tp = 0;
   switch(TP_MODE) { case 1: tp = tp1; break; case 2: tp = tp2; break; case 3: tp = tp3; break; }

   if(PlacePending(symbol, "SELL", entry, tp, sl, signalId))
   {
      string pair = symbol;
      GlobalVariableSet(GvKey(pair, "Entry"), entry);
      GlobalVariableSet(GvKey(pair, "SL"), sl);
      GlobalVariableSet(GvKey(pair, "TP"), tp);
      GlobalVariableSet(GvKey(pair, "Dir"), 2);
   }
}

int g_signalCounter = 1000;

int GenerateSignalId()
{
   return MAGIC_NUMBER + g_signalCounter++;
}

int CountTodaySignals()
{
   // Count from GlobalVariables with today's date prefix
   int count = 0;
   string todayStr = TimeToString(TimeCurrent(), TIME_DATE);
   int gvTotal = GlobalVariablesTotal();
   for(int i = 0; i < gvTotal; i++)
   {
      string name = GlobalVariableName(i);
      if(StringFind(name, "ATH_SignalId_") == 0)
         count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| JSON helper                                                       |
//+------------------------------------------------------------------+
string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", "\\n");
   StringReplace(s, "\r", "\\r");
   return s;
}

//+------------------------------------------------------------------+
//| ACCOUNT MONITORING — Send account info to server                  |
//+------------------------------------------------------------------+
bool SendAccountInfo()
{
   string broker  = AccountInfoString(ACCOUNT_COMPANY);
   int    login   = (int)AccountInfoInteger(ACCOUNT_LOGIN);
   string name    = AccountInfoString(ACCOUNT_NAME);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double profit  = AccountInfoDouble(ACCOUNT_PROFIT);
   string modeStr = (g_mode == 0) ? "online" : "offline";

   Print("[SignalReceiver] SendAccountInfo() called — broker=", broker, " login=", login);

   string json = "{"
      + "\"broker\":\""   + JsonEscape(broker) + "\","
      + "\"login\":"      + IntegerToString(login) + ","
      + "\"name\":\""     + JsonEscape(name)   + "\","
      + "\"balance\":"    + DoubleToString(balance, 2) + ","
      + "\"profit\":"     + DoubleToString(profit, 2) + ","
      + "\"mode\":\""     + modeStr + "\""
      + "}";

   char data[];
   char result[];
   string resultHeaders;
   StringToCharArray(json, data, 0, StringLen(json));

   string headers = "X-MT5-Key: " + API_KEY + "\r\n"
                  + "Content-Type: application/json\r\n";

   string url = API_URL;
   StringReplace(url, "/signals/mt5", "/ea/heartbeat");

   int res = WebRequest("POST", url, headers, 5000, data, result, resultHeaders);
   if(res == -1)
   {
      int err = GetLastError();
      Print("[SignalReceiver] AccountInfo WebRequest FAILED res=", res, " LastError=", err);
      return false;
   }

   Print("[SignalReceiver] AccountInfo WebRequest HTTP ", res);
   if(res == 200) Print("[SignalReceiver] AccountInfo sent OK (", broker, " #", login, " $", DoubleToString(balance, 2), ")");
   return (res == 200);
}
