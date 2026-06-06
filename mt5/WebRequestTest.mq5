//+------------------------------------------------------------------+
//|                                             WebRequestTest.mq5 |
//|                                        Simple WebRequest Tester |
//+------------------------------------------------------------------+
#property copyright "ATH Trader"
#property version   "1.0"
#property description "Test WebRequest connectivity to API"
#property description "Drag to any chart, check Experts log for result"

input string API_URL  = "https://forex-rouge-gamma.vercel.app/api/signals/mt5";
input string API_KEY  = "d0d52fa0d8070ec18b99375dd25baa5b46338653dd5ea7c8";

//+------------------------------------------------------------------+
int OnInit()
{
   Print("══════════════════════════════════════════════");
   Print("[WebRequestTest] Testing connection...");
   Print("  URL: ", API_URL);
   Print("══════════════════════════════════════════════");

   TestConnection();
   return INIT_SUCCEEDED;
}

void TestConnection()
{
   char   data[];
   char   result[];
   string resultHeaders;
   string headers = "X-MT5-Key: " + API_KEY + "\r\n"
                  + "Accept: application/json\r\n";

   int res = WebRequest("GET", API_URL, headers, 10000, data, result, resultHeaders);

   if(res == -1 || res > 599 || res < 100)
   {
      int err = GetLastError();
      Print("【FAILED】 WebRequest error");
      Print("  res       = ", res);
      Print("  LastError = ", err);

      if(err == 4014)
         Print("  → ERROR 4014: URL not in allowed list!");
      else if(err == 5203)
         Print("  → ERROR 5203: URL not allowed or SSL error!");
      else if(err == 5205)
         Print("  → ERROR 5205: connection timeout!");
      else if(err == 5206)
         Print("  → ERROR 5206: connection refused!");
      Print("  → Fix: Tools → Options → Expert Advisors → Allow WebRequest");
      return;
   }

   Print("【SUCCESS】 HTTP ", res);
   Print("  Response: ", CharArrayToString(result));
}
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("[WebRequestTest] Done");
}
//+------------------------------------------------------------------+
