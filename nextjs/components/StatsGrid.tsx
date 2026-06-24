interface StatsGridProps {
  totalSignals: number
  buyWins: number
  sellWins: number
  vipCount: number
}

export default function StatsGrid({ totalSignals, buyWins, sellWins, vipCount }: StatsGridProps) {
  const stats = [
    { label: 'สัญญาณทั้งหมด', value: totalSignals.toLocaleString(), icon: '●', gold: false },
    { label: 'BUY ที่ชนะ', value: buyWins.toLocaleString(), icon: '▲', gold: true },
    { label: 'SELL ที่ชนะ', value: sellWins.toLocaleString(), icon: '▼', gold: true },
    { label: 'สมาชิก VIP', value: vipCount.toLocaleString(), icon: '★', gold: false },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`card-glow text-center ${stat.gold ? 'border-gold-500/20 bg-gradient-to-b from-navy-800 to-navy-800/30' : ''}`}
        >
          <div className={`text-xl mb-1 ${stat.gold ? 'text-gold-400' : 'text-gray-400'}`}>
            {stat.icon}
          </div>
          <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
          <div className={`text-2xl font-bold ${stat.gold ? 'gradient-text' : 'text-white'}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}
