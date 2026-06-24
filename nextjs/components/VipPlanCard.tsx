import type { VipPlan } from '@/types'

export default function VipPlanCard({ plan }: { plan: VipPlan }) {
  return (
    <div
      className={`relative rounded-xl p-6 border transition-all duration-300 ${
        plan.highlighted
          ? 'border-gold-500 bg-gradient-to-b from-navy-800 to-navy-900 shadow-lg shadow-gold-500/10 scale-105 md:scale-110'
          : 'border-navy-700 bg-navy-800/50 hover:border-navy-600'
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 text-xs font-bold rounded-full">
          แนะนำ
        </div>
      )}
      <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
      <div className="mb-4">
        <span className="text-3xl font-bold gradient-text">{plan.price}</span>
      </div>
      <ul className="space-y-2.5 mb-6">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
            <svg className="w-4 h-4 text-gold-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <button
        className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
          plan.highlighted
            ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 hover:from-gold-300 hover:to-gold-400 shadow-lg shadow-gold-500/20'
            : 'border border-gold-500/30 text-gold-400 hover:bg-gold-500/10'
        }`}
      >
        {plan.highlighted ? 'เริ่มใช้ทันที' : 'เลือกแผนนี้'}
      </button>
    </div>
  )
}
