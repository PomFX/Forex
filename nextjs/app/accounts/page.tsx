'use client'

import { useState } from 'react'
import type { VipPlan } from '@/types'
import VipPlanCard from '@/components/VipPlanCard'

const plans: VipPlan[] = [
  {
    name: 'Free',
    price: 'ฟรี',
    color: 'gray',
    features: [
      'ดูสัญญาณเทรดล่าสุด',
      'ดูสถิติพื้นฐาน',
      'อ่านบทความทั่วไป',
      'ดูโบรกเกอร์แนะนำ',
    ],
  },
  {
    name: 'Silver',
    price: '500 บาท',
    color: 'silver',
    features: [
      'สัญญาณเทรดรายวัน 3-5 สัญญาณ',
      'แจ้งเตือนผ่าน Line',
      'TP1-3 และ SL ทุกสัญญาณ',
      'เหตุผลทางเทคนิค (Reason)',
      'วิเคราะห์ทองคำ XAU/USD',
      'กลุ่ม Line VIP',
    ],
  },
  {
    name: 'Gold',
    price: '1,500 บาท',
    color: 'gold',
    highlighted: true,
    features: [
      'สัญญาณเทรดรายวัน 5-8 สัญญาณ',
      'แจ้งเตือนผ่าน Line ทันที',
      'TP1-3 และ SL ครบทุกสัญญาณ',
      'วิเคราะห์เทคนิคเจาะลึก',
      'บทวิเคราะห์ทองคำรายวัน',
      'กลุ่ม Line VIP พร้อมวิเคราะห์',
      'MT5 Signal Auto-Trade',
      'สิทธิพิเศษการถอนเงิน',
    ],
  },
  {
    name: 'Platinum',
    price: '3,000 บาท',
    color: 'purple',
    features: [
      'สัญญาณเทรดไม่จำกัดต่อวัน',
      'แจ้งเตือนทุกช่องทาง',
      'TP1-3 และ SL ครบทุกสัญญาณ',
      'วิเคราะห์เทคนิคระดับสูง',
      'บทวิเคราะห์ทองคำ + สินค้าโภคภัณฑ์',
      'กลุ่ม Line VIP Exclusive',
      'MT5 Signal Auto-Trade',
      'EA Dashboard ส่วนตัว',
      'AI Signal Generator',
      'สิทธิพิเศษการถอนเงินระดับสูง',
    ],
  },
]

const comparisonFeatures = [
  { label: 'สัญญาณเทรดรายวัน', free: 'จำกัด', silver: '3-5', gold: '5-8', platinum: 'ไม่จำกัด' },
  { label: 'แจ้งเตือน Line', free: '✕', silver: '✓', gold: '✓', platinum: '✓' },
  { label: 'เหตุผลทางเทคนิค', free: '✕', silver: '✓', gold: '✓', platinum: '✓' },
  { label: 'บทวิเคราะห์ทองคำ', free: '✕', silver: '✓', gold: '✓', platinum: '✓' },
  { label: 'MT5 Auto-Trade', free: '✕', silver: '✕', gold: '✓', platinum: '✓' },
  { label: 'AI Signal Generator', free: '✕', silver: '✕', gold: '✕', platinum: '✓' },
  { label: 'กลุ่ม Line VIP', free: '✕', silver: '✓', gold: '✓', platinum: '✓' },
  { label: 'EA Dashboard', free: '✕', silver: '✕', gold: '✕', platinum: '✓' },
]

const faqItems = [
  { q: 'สามารถอัปเกรดได้หรือไม่?', a: 'ได้ เมื่อคุณเป็นสมาชิกอยู่แล้ว สามารถอัปเกรดเป็นแพ็กเกจที่สูงขึ้นได้ทุกเมื่อ โดยแจ้งผ่าน Line หรือติดต่อแอดมิน' },
  { q: 'แพลตฟอร์มไหนที่รองรับ?', a: 'รองรับทั้ง MT4, MT5, และ cTrader สัญญาณเทรดของเราสามารถใช้งานได้กับทุกโบรกเกอร์' },
  { q: 'ได้สิทธิ์อะไรบ้างเมื่ออัปเกรด?', a: 'คุณจะได้รับสิทธิ์ในการเข้าถึงสัญญาณเทรดที่มากขึ้น การแจ้งเตือนที่เร็วขึ้น และเครื่องมือวิเคราะห์เพิ่มเติมตามแพ็กเกจ' },
  { q: 'การชำระเงินช่องทางไหนบ้าง?', a: 'รองรับการชำระผ่านโอนเงินธนาคารไทย, True Wallet, และ Crypto (USDT) - แจ้งหลักฐานการชำระผ่าน Line' },
]

export default function AccountsPage() {
  const [showComparison, setShowComparison] = useState(false)

  return (
    <div className="pt-24 pb-16">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
        <div className="animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            เลือก<span className="gradient-text">บัญชี</span>ที่ใช่สำหรับคุณ
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            เลือกแผนที่เหมาะกับสไตล์การเทรดของคุณ รับสิทธิพิเศษมากมาย
            ยิ่งอัปเกรด ยิ่งได้เปรียบ
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/register" className="btn-primary text-lg px-8 py-4">
              สมัครสมาชิกฟรี
            </a>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="btn-secondary text-lg px-8 py-4"
            >
              {showComparison ? 'ซ่อนตารางเปรียบเทียบ' : 'เปรียบเทียบแพ็กเกจ'}
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 items-start max-w-5xl mx-auto">
          {plans.map((plan) => (
            <VipPlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>

      {showComparison && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 animate-fade-in">
          <h2 className="section-title mb-8">เปรียบเทียบแพ็กเกจ</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">ฟีเจอร์</th>
                  {plans.map((p) => (
                    <th key={p.name} className={`py-3 px-4 text-center font-semibold ${p.highlighted ? 'text-gold-400' : 'text-white'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feat, i) => (
                  <tr key={feat.label} className={`border-b border-navy-800 ${i % 2 === 0 ? 'bg-navy-800/30' : ''}`}>
                    <td className="py-3 px-4 text-gray-300">{feat.label}</td>
                    {(['free', 'silver', 'gold', 'platinum'] as const).map((tier) => (
                      <td key={tier} className={`py-3 px-4 text-center ${feat[tier] === '✓' ? 'text-green-400' : feat[tier] === '✕' ? 'text-gray-600' : 'text-white'}`}>
                        {feat[tier]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="section-title mb-8">คำถามที่พบบ่อย</h2>
        <div className="space-y-4">
          {faqItems.map((item) => (
            <details key={item.q} className="card group open:border-gold-500/30">
              <summary className="text-white font-medium cursor-pointer py-2 flex items-center justify-between">
                {item.q}
                <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="text-gray-400 text-sm mt-2 pt-2 border-t border-navy-700">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-800 via-navy-800 to-navy-800 border border-navy-700 p-8 md:p-12 text-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              พร้อมเริ่มเทรดอย่างมืออาชีพแล้วหรือยัง?
            </h2>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              สมัครวันนี้ รับสิทธิ์ทดลองใช้งานแพ็กเกจ VIP 3 วันแรกฟรี!
            </p>
            <a href="/register" className="btn-primary text-lg px-8 py-4">
              สมัครสมาชิกเลย
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
