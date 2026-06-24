export default function Footer() {
  return (
    <footer className="bg-navy-900 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold mb-3">
              <span className="text-gold-400">&#9650;</span>
              <span className="text-white">ATH</span>
              <span className="text-gold-400">Trader</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              ให้บริการสัญญาณเทรด Forex แม่นยำ พร้อมทีมวิเคราะห์มืออาชีพ
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">เมนู</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/" className="hover:text-gold-400 transition-colors">หน้าแรก</a></li>
              <li><a href="/accounts" className="hover:text-gold-400 transition-colors">ประเภทบัญชี</a></li>
              <li><a href="/signals" className="hover:text-gold-400 transition-colors">สัญญาณเทรด</a></li>
              <li><a href="/brokers" className="hover:text-gold-400 transition-colors">โบรกเกอร์</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">คำเตือน</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              การเทรด Forex มีความเสี่ยงสูง โปรดศึกษาให้ดีก่อนลงทุน ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
            </p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-navy-800 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} ATH Trader. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
