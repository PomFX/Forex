interface GoldStatsProps {
  total: number
  wins: number
  losses: number
  winRate: number
  active: number
}

export default function GoldStats({ total, wins, losses, winRate, active }: GoldStatsProps) {
  return (
    <div className="grid grid-cols-5 gap-2 md:gap-4">
      {[
        { label: 'สัญญาณ', value: total, className: '' },
        { label: 'ชนะ', value: wins, className: 'text-green-400' },
        { label: 'แพ้', value: losses, className: 'text-red-400' },
        { label: 'อัตราชนะ', value: `${winRate}%`, className: 'text-gold-400' },
        { label: 'รอผล', value: active, className: '' },
      ].map((item) => (
        <div key={item.label} className="card-glow text-center">
          <div className={`text-lg md:text-2xl font-bold ${item.className || 'text-white'}`}>
            {item.value}
          </div>
          <div className="text-xs text-gray-400 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
