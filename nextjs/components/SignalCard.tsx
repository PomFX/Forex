import type { Signal } from '@/types'

const statusConfig = {
  active: { label: 'Active', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  win: { label: 'Win', className: 'bg-green-500/10 text-green-400 border-green-500/30' },
  loss: { label: 'Loss', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
}

export default function SignalCard({ signal }: { signal: Signal }) {
  const config = statusConfig[signal.status]
  const isBuy = signal.direction === 'BUY'

  return (
    <div className="card-glow animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-400">{signal.pair}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}>
          {config.label}
        </span>
      </div>
      <div className={`text-lg font-bold mb-2 ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
        {signal.direction}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Entry</span>
          <span className="font-mono font-medium">{signal.entry}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">TP1 / TP2 / TP3</span>
          <span className="font-mono text-gold-400">{signal.tp1} / {signal.tp2} / {signal.tp3}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">SL</span>
          <span className="font-mono text-red-400">{signal.sl}</span>
        </div>
      </div>
      {signal.reason && (
        <div className="mt-3 pt-3 border-t border-navy-700">
          <p className="text-xs text-gray-500 leading-relaxed">{signal.reason}</p>
        </div>
      )}
    </div>
  )
}
