import type { Broker } from '@/types'

export default function BrokerCard({ broker }: { broker: Broker }) {
  return (
    <div className="card-glow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-navy-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {broker.logo ? (
            <img src={broker.logo} alt={broker.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-gold-400 font-bold text-lg">{broker.name[0]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">{broker.name}</h3>
            <div className="flex items-center gap-0.5 text-gold-400 text-xs">
              <span>★</span>
              <span>{broker.rating}</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 line-clamp-2">{broker.description}</p>
        </div>
      </div>
      {broker.ib_link && (
        <a
          href={broker.ib_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 w-full inline-flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium text-gold-400 bg-gold-500/10 border border-gold-500/20 rounded-lg hover:bg-gold-500/20 transition-colors"
        >
          เปิดบัญชี
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  )
}
