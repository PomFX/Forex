//+------------------------------------------------------------------+
//| BOS_LuxAlgo_Bridge.mq5                                           |
//| X FUSION — อ่าน BOS/CHoCH จาก LuxAlgo SMC → ส่ง Signal ไปเว็บ   |
//| v1.3 — Fixed: TF, JSON encoding, URL encode, ATR handle leak     |
//+------------------------------------------------------------------+
#property copyright "X FUSION"
#property version   "1.3"
#property description "Reads BOS/CHoCH objects from LuxAlgo SMC, sends to X FUSION server"

//--- Input Parameters
input string   API_URL        = "https://forex-rouge-gamma.vercel.app";
input string   API_KEY        = "8765471ef4ba70cfd8c4b813abf272f490a6faee84fd8a183ab37a5ca7ccb5a4";
input string   PAIR_NAME      = "";           // ปล่อยว่าง = auto-detect
input bool     SEND_BOS       = true;         // ส่ง BOS signals
input bool     SEND_CHOCH     = true;         // ส่ง CHoCH signals
input int      DEBOUNCE_BARS  = 3;            // min bars ระหว่าง signal
input int      HEARTBEAT_MIN  = 15;           // heartbeat ทุก N นาที (0=ปิด)
input bool     DEBUG_MODE     = true;         // แสดง log รายละเอียด

//--- Global Handles & Tracking
int      g_atrHandle    = INVALID_HANDLE;  // [FIX#4] global ATR handle
datetime g_lastBarTime  = 0;
datetime g_lastSentTime = 0;
string   g_lastSentPair = "";
string   g_lastSentType = "";
string   g_seenObjects[];

//+------------------------------------------------------------------+
int OnInit()
{
   ArrayResize(g_seenObjects, 0);

   // [FIX#4] สร้าง ATR handle ครั้งเดียวตอน init
   g_atrHandle = iATR(_Symbol, _Period, 14);
   if (g_atrHandle == INVALID_HANDLE)
      Print("[Init] ⚠ ATR handle failed — will use fallback ATR");

   Print("══════════════════════════════════════════════");
   Print("[LuxAlgo Bridge] v1.3 Initialized on ", _Symbol, " / ", EnumToString(_Period));
   Print("  API: ", API_URL);
   Print("  Pair: ", SymbolToPair());
   Print("  BOS: ", SEND_BOS, " | CHoCH: ", SEND_CHOCH);
   Print("  Debounce: ", DEBOUNCE_BARS, " bars");

   // [FIX#5] แจ้งเตือน URL ที่ต้องเพิ่มใน Allowed List
   Print("  ⚠ Make sure this URL is in MT5 Allowed list:");
   Print("    ", API_URL);

   if (HEARTBEAT_MIN > 0)
   {
      EventSetTimer(HEARTBEAT_MIN * 60);
      Print("  Heartbeat: every ", HEARTBEAT_MIN, " min");
   }
   SendHeartbeat();
   Print("══════════════════════════════════════════════");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   // [FIX#4] Release ATR handle
   if (g_atrHandle != INVALID_HANDLE)
   {
      IndicatorRelease(g_atrHandle);
      g_atrHandle = INVALID_HANDLE;
   }
}

void OnTimer() { SendHeartbeat(); }

//+------------------------------------------------------------------+
//| OnTick — ตรวจทุก bar ใหม่ตาม TF จริงของ chart                    |
//+------------------------------------------------------------------+
void OnTick()
{
   // [FIX#1] เปลี่ยนจาก PERIOD_M15 → _Period (TF จริงของ chart)
   datetime barTime = iTime(_Symbol, _Period, 0);
   if (barTime == g_lastBarTime) return;
   g_lastBarTime = barTime;

   ScanLuxAlgoObjects();
}

//+------------------------------------------------------------------+
//| Scan chart objects หา BOS/CHoCH ใหม่จาก LuxAlgo                  |
//+------------------------------------------------------------------+
void ScanLuxAlgoObjects()
{
   int total = ObjectsTotal(0, -1, -1);
   if (DEBUG_MODE) Print("[Scan] Total objects: ", total);

   datetime latestTime  = 0;
   string   latestName  = "";
   string   latestType  = "";
   string   latestDir   = "";
   double   latestPrice = 0;

   for (int i = 0; i < total; i++)
   {
      string objName = ObjectName(0, i, -1, -1);
      string objText = ObjectGetString(0, objName, OBJPROP_TEXT);

      if (DEBUG_MODE && objText != "")
         Print("[Check] Object ", i, ": name=", objName, " text=[", objText, "]");

      // กรอง EQL/Equilibrium ออก
      bool isEQL = (StringFind(objText, "EQL") >= 0 ||
                    StringFind(objText, "EQ")  >= 0 ||
                    StringFind(objText, "Equal") >= 0);
      if (isEQL) continue;

      bool isBOS   = (SEND_BOS   && (StringFind(objText, "BOS")   >= 0 ||
                                      StringFind(objText, "BoS")   >= 0));
      bool isCHoCH = (SEND_CHOCH && (StringFind(objText, "CHoCH") >= 0 ||
                                      StringFind(objText, "ChoCh") >= 0 ||
                                      StringFind(objText, "CHOCH") >= 0));

      if (!isBOS && !isCHoCH) continue;

      datetime objTime  = (datetime)ObjectGetInteger(0, objName, OBJPROP_TIME);
      double   objPrice = ObjectGetDouble(0, objName, OBJPROP_PRICE);
      color    objColor = (color)ObjectGetInteger(0, objName, OBJPROP_COLOR);

      if (DEBUG_MODE)
         Print("[Object] ", objText, " | ", objName,
               " | color=", objColor,
               " | price=", objPrice,
               " | time=", TimeToString(objTime));

      if (AlreadySent(objName))
      {
         if (DEBUG_MODE) Print("[Skip] Already sent: ", objName);
         continue;
      }

      // รับเฉพาะ 100 bars ล่าสุด
      datetime cutoff = TimeCurrent() - (100 * PeriodSeconds(_Period));
      if (objTime < cutoff)
      {
         if (DEBUG_MODE) Print("[Skip] Too old: ", objName);
         continue;
      }

      string dir = DetectDirection(objColor, objPrice);
      if (dir == "")
      {
         if (DEBUG_MODE) Print("[Skip] Unknown color: ", objName);
         continue;
      }

      if (objTime > latestTime)
      {
         latestTime  = objTime;
         latestName  = objName;
         latestType  = isBOS ? "BOS" : "CHoCH";
         latestDir   = dir;
         latestPrice = objPrice;
      }
   }

   if (latestName == "")
   {
      if (DEBUG_MODE) Print("[Scan] No new BOS/CHoCH found.");
      return;
   }

   // Debounce ต่อคู่ + ต่อ type
   datetime debounceSec = (datetime)(DEBOUNCE_BARS * PeriodSeconds(_Period));
   string pair = SymbolToPair();
   if (pair == g_lastSentPair &&
       latestType == g_lastSentType &&
       (TimeCurrent() - g_lastSentTime) < debounceSec)
   {
      Print("[Bridge] Debounce: skipping ", latestType, " on ", pair, " (too soon)");
      MarkAsSent(latestName);
      return;
   }

   g_lastSentTime = TimeCurrent();
   g_lastSentPair = pair;
   g_lastSentType = latestType;
   MarkAsSent(latestName);

   SendSignal(latestType, latestDir, latestPrice);
}

//+------------------------------------------------------------------+
//| ตรวจทิศทางจากสี (BGR format ของ MT5)                             |
//+------------------------------------------------------------------+
string DetectDirection(color objColor, double objPrice)
{
   int real_R = (int)( objColor        & 0xFF);
   int real_G = (int)((objColor >> 8)  & 0xFF);
   int real_B = (int)((objColor >> 16) & 0xFF);

   if (DEBUG_MODE)
      Print("[Color] R=", real_R, " G=", real_G, " B=", real_B, " | raw=", objColor);

   // Exact match LuxAlgo SMC default
   if (objColor == C'8,153,129')  return "bullish";
   if (objColor == C'242,54,69')  return "bearish";

   // Blue = OB zone → skip
   if (real_B > real_R && real_B > real_G && real_B > 120)
   {
      if (DEBUG_MODE) Print("[Color] Blue → skip (OB zone)");
      return "";
   }

   // Green dominant = Bullish
   if (real_G > real_R && real_G > 80) return "bullish";

   // Red dominant = Bearish
   if (real_R > real_G && real_R > 80) return "bearish";

   if (DEBUG_MODE) Print("[Color] Unknown → skip");
   return "";
}

//+------------------------------------------------------------------+
bool AlreadySent(string name)
{
   for (int i = 0; i < ArraySize(g_seenObjects); i++)
      if (g_seenObjects[i] == name) return true;
   return false;
}

void MarkAsSent(string name)
{
   int n = ArraySize(g_seenObjects);
   ArrayResize(g_seenObjects, n + 1);
   g_seenObjects[n] = name;
   if (ArraySize(g_seenObjects) > 500)
      ArrayRemove(g_seenObjects, 0, 100);
}

//+------------------------------------------------------------------+
//| Auto-detect pair name จาก symbol                                  |
//+------------------------------------------------------------------+
string SymbolToPair()
{
   if (PAIR_NAME != "") return PAIR_NAME;
   string sym = _Symbol;
   if (StringFind(sym, "GOLD") >= 0 || StringFind(sym, "XAU") >= 0) return "XAU/USD";
   if (StringFind(sym, "SILV") >= 0 || StringFind(sym, "XAG") >= 0) return "XAG/USD";
   string known[] = {
      "EUR","GBP","USD","JPY","CHF","AUD","NZD","CAD",
      "XAU","XAG","XPT","XPD","BTC","ETH","XRP","LTC","BNB"
   };
   int symLen = StringLen(sym);
   for (int start = 0; start <= symLen - 6; start++)
   {
      string base  = StringSubstr(sym, start, 3);
      string quote = StringSubstr(sym, start + 3, 3);
      bool baseOk = false, quoteOk = false;
      for (int i = 0; i < ArraySize(known); i++)
      {
         if (base  == known[i]) baseOk  = true;
         if (quote == known[i]) quoteOk = true;
      }
      if (baseOk && quoteOk && base != quote)
         return base + "/" + quote;
   }
   return sym;
}

//+------------------------------------------------------------------+
//| Encode pair name สำหรับใส่ใน URL query string                     |
//+------------------------------------------------------------------+
string UrlEncodePair(string pair)
{
   // [FIX#3] encode / → %2F ป้องกัน path เพี้ยน
   StringReplace(pair, "/", "%2F");
   StringReplace(pair, " ", "%20");
   return pair;
}

//+------------------------------------------------------------------+
//| ส่ง Signal ไปเว็บ                                                 |
//+------------------------------------------------------------------+
void SendSignal(string sigType, string direction, double price)
{
   string pair = SymbolToPair();
   string bid  = DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);

   // [FIX#4] ใช้ global ATR handle
   double atr = 0;
   if (g_atrHandle != INVALID_HANDLE)
   {
      double atrBuf[1];
      if (CopyBuffer(g_atrHandle, 0, 1, 1, atrBuf) > 0)
         atr = atrBuf[0];
   }
   if (atr == 0 || atr == EMPTY_VALUE) atr = 10 * _Point;

   double obHigh, obLow;
   if (direction == "bullish")
   {
      obHigh = price + atr * 2;
      obLow  = price - atr * 0.5;
   }
   else
   {
      obHigh = price + atr * 0.5;
      obLow  = price - atr * 2;
   }

   // TF จริงของ chart
   string tf;
   switch(_Period)
   {
      case PERIOD_M1:  tf = "M1";  break;
      case PERIOD_M5:  tf = "M5";  break;
      case PERIOD_M15: tf = "M15"; break;
      case PERIOD_M30: tf = "M30"; break;
      case PERIOD_H1:  tf = "H1";  break;
      case PERIOD_H4:  tf = "H4";  break;
      case PERIOD_D1:  tf = "D1";  break;
      default:         tf = "M15"; break;
   }

   string json = "{";
   json += "\"pair\":\""          + pair                             + "\",";
   json += "\"bosType\":\""       + direction                        + "\",";
   json += "\"signalSource\":\"LuxAlgo-SMC\",";
   json += "\"signalLabel\":\""   + sigType                          + "\",";
   json += "\"timeframe\":\""     + tf                               + "\",";
   json += "\"bosPrice\":\""      + DoubleToString(price,  _Digits)  + "\",";
   json += "\"obHigh\":\""        + DoubleToString(obHigh, _Digits)  + "\",";
   json += "\"obLow\":\""         + DoubleToString(obLow,  _Digits)  + "\",";
   json += "\"prevSwing\":\""     + DoubleToString(price,  _Digits)  + "\",";
   json += "\"slReference\":\""   + DoubleToString(obLow,  _Digits)  + "\",";
   json += "\"currentPrice\":\""  + bid                              + "\"";
   json += "}";

   Print("[Bridge] Sending ", sigType, " ", direction,
         " on ", pair, " @ ", bid,
         " OB=", DoubleToString(obHigh, _Digits), "/", DoubleToString(obLow, _Digits));

   HttpPost(json);
}

//+------------------------------------------------------------------+
//| HTTP POST with retry + fixed JSON encoding                        |
//+------------------------------------------------------------------+
void HttpPost(string jsonData)
{
   char   data[];
   char   result[];
   string resultHeaders;

   // [FIX#2] ใช้ CP_UTF8 + ตัด null terminator อย่างถูกต้อง
   int dataLen = StringToCharArray(jsonData, data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   if (dataLen < 1)
   {
      Print("[HTTP] ⚠ Empty JSON data — abort");
      return;
   }
   ArrayResize(data, dataLen);

   string headers = "Content-Type: application/json\r\n"
                  + "X-MT5-Key: " + API_KEY + "\r\n"
                  + "Accept: application/json\r\n";

   string url = API_URL + "/api/signals/mt5/bos-candidate";
   Print("[HTTP] POST → ", url);

   int res     = -1;
   int retries = 5;

   for (int i = 0; i < retries; i++)
   {
      res = WebRequest("POST", url, headers, 30000, data, result, resultHeaders);
      if (res == 200) break;
      Print("[HTTP] Retry ", i + 1, "/", retries, " — Status=", res);
      if (i < retries - 1) Sleep(5000);
   }

   if (res == -1)
   {
      int err = GetLastError();
      Print("[HTTP] FAILED | Error=", err);
      if (err == 4014)
         Print("[HTTP] ⚠ Add URL to MT5 Allowed list: ", url);
      return;
   }

   string resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   Print("[HTTP] Status=", res, " | Response=", StringSubstr(resp, 0, 200));

   if (res != 200)
   {
      Print("[Bridge] ⚠ HTTP error ", res);
      return;
   }

   // ตรวจว่า response เป็น JSON จริง
   if (StringFind(resp, "{") < 0)
   {
      Print("[Bridge] ⚠ Unexpected response format (not JSON) — check VPS URL allowed list");
      return;
   }

   if (StringFind(resp, "\"hasSetup\":true") >= 0)
      Print("[Bridge] ✅ SIGNAL CREATED!");
   else if (StringFind(resp, "\"hasSetup\":false") >= 0)
      Print("[Bridge] ⏸ AI declined: no valid setup");
   else
      Print("[Bridge] ⚠ Unexpected response format");
}

//+------------------------------------------------------------------+
//| Heartbeat                                                         |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   // [FIX#3] encode pair ป้องกัน / ทำให้ URL path เพี้ยน
   string pairEncoded = UrlEncodePair(SymbolToPair());

   string url = API_URL + "/api/ea/heartbeat"
              + "?key="     + API_KEY
              + "&status=ping"
              + "&pair="    + pairEncoded
              + "&version=LuxAlgo-Bridge-v1.3";

   char data[], result[];
   string headers = "Accept: application/json\r\n";

   int res = WebRequest("GET", url, headers, 10000, data, result, headers);

   if (res == 200)
      Print("[Heartbeat] ✅ OK");
   else if (res == -1)
   {
      int err = GetLastError();
      Print("[Heartbeat] FAILED | Error=", err);
      if (err == 4014)
         Print("[Heartbeat] ⚠ Add URL to MT5 Allowed list: ", API_URL);
   }
   else
      Print("[Heartbeat] HTTP ", res);
}
//+------------------------------------------------------------------+