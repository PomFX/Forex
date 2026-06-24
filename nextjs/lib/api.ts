const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  getStats: () => fetchAPI<import('@/types').PublicStats>('/stats/public'),
  getGoldStats: () => fetchAPI<import('@/types').GoldStats>('/stats/gold'),
  getSignals: () => fetchAPI<import('@/types').Signal[]>('/signals'),
  getArticles: () => fetchAPI<import('@/types').Article[]>('/articles'),
  getBrokers: () => fetchAPI<import('@/types').Broker[]>('/brokers'),
}
