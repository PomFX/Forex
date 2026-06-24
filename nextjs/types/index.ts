export interface Signal {
  id: number
  pair: string
  direction: 'BUY' | 'SELL'
  entry: string
  tp1: string
  tp2: string
  tp3: string
  sl: string
  status: 'active' | 'win' | 'loss'
  reason: string
  created_at: string
}

export interface Article {
  id: number
  title: string
  content: string
  image: string
  created_at: string
}

export interface Broker {
  id: number
  name: string
  description: string
  ib_link: string
  logo: string
  rating: number
  promotions: string
}

export interface VipPlan {
  name: string
  price: string
  color: string
  features: string[]
  highlighted?: boolean
}

export interface PublicStats {
  total_signals: number
  total_buy_wins: number
  total_sell_wins: number
  total_vip: number
}

export interface GoldStats {
  total: number
  wins: number
  losses: number
  win_rate: number
  active: number
}
