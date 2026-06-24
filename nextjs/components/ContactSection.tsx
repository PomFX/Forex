export default function ContactSection() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {[
        { icon: '💬', label: 'Line ID', value: '@athtrader' },
        { icon: '📧', label: 'อีเมล', value: 'contact@athtrader.com' },
        { icon: '📘', label: 'Facebook', value: 'ATH Trader' },
        { icon: '🎵', label: 'TikTok', value: '@athtrader' },
        { icon: '▶', label: 'YouTube', value: 'ATH Trader' },
      ].map((item) => (
        <div key={item.label} className="card-glow text-center min-w-[140px]">
          <div className="text-2xl mb-1">{item.icon}</div>
          <div className="text-xs text-gray-500 mb-0.5">{item.label}</div>
          <div className="text-sm font-medium text-gold-400">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
