'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Signal, Article, Broker, PublicStats, GoldStats } from '@/types'
import StatsGrid from '@/components/StatsGrid'
import GoldStatsComponent from '@/components/GoldStats'
import SignalCard from '@/components/SignalCard'
import BrokerCard from '@/components/BrokerCard'
import ArticleCard from '@/components/ArticleCard'
import ContactSection from '@/components/ContactSection'

export default function HomePage() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [goldStats, setGoldStats] = useState<GoldStats | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsData, goldData, signalsData, brokersData, articlesData] = await Promise.all([
          api.getStats().catch(() => null),
          api.getGoldStats().catch(() => null),
          api.getSignals().catch(() => []),
          api.getBrokers().catch(() => []),
          api.getArticles().catch(() => []),
        ])
        setStats(statsData)
        setGoldStats(goldData)
        setSignals(Array.isArray(signalsData) ? signalsData.slice(0, 4) : [])
        setBrokers(Array.isArray(brokersData) ? brokersData : [])
        setArticles(Array.isArray(articlesData) ? articlesData.slice(0, 3) : [])
      } catch (err) {
        console.error('Failed to load data', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212, 160, 23, 0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-gold-500/3 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="animate-slide-up max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              เทรด Forex{' '}
              <span className="gradient-text">อย่างมืออาชีพ</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              รับสัญญาณเทรดแม่นยำจากทีมวิเคราะห์ พร้อมโบรกเกอร์แนะนำและบทความให้ความรู้
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/register" className="btn-primary text-lg px-8 py-4">
                เริ่มต้นเทรดวันนี้
              </a>
              <a href="/signals" className="btn-secondary text-lg px-8 py-4">
                ดูสัญญาณเทรด
              </a>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                ตลาดเปิดอยู่
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                สัญญาณอัปเดตตลอด 24 ชม.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        {stats && <StatsGrid totalSignals={stats.total_signals} buyWins={stats.total_buy_wins} sellWins={stats.total_sell_wins} vipCount={stats.total_vip} />}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="section-title">สถิติทองคำ <span className="gradient-text">XAU/USD</span></h2>
        <p className="section-subtitle">ติดตามผลการวิเคราะห์ทองคำล่าสุดจากทีมงาน</p>
        {goldStats && <GoldStatsComponent total={goldStats.total} wins={goldStats.wins} losses={goldStats.losses} winRate={goldStats.win_rate} active={goldStats.active} />}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="section-title">โบรกเกอร์แนะนำ</h2>
        <p className="section-subtitle">เลือกเทรดกับโบรกเกอร์ชั้นนำ พร้อม IB Link พิเศษ</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brokers.map((broker) => (
            <BrokerCard key={broker.id} broker={broker} />
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="section-title">ช่องทางติดต่อ</h2>
        <p className="section-subtitle">ติดต่อเราได้ทุกช่องทาง</p>
        <ContactSection />
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="section-title text-left">สัญญาณเทรดล่าสุด</h2>
            <p className="text-gray-400">อัปเดตแบบเรียลไทม์จากทีมวิเคราะห์</p>
          </div>
          <a href="/signals" className="btn-outline hidden sm:inline-flex">ดูทั้งหมด</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
        <div className="text-center mt-6 sm:hidden">
          <a href="/signals" className="btn-outline">ดูทั้งหมด</a>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="section-title text-left">บทความล่าสุด</h2>
            <p className="text-gray-400">ความรู้และข่าวสารวงการ Forex</p>
          </div>
          <a href="/articles" className="btn-outline hidden sm:inline-flex">อ่านทั้งหมด</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
        <div className="text-center mt-6 sm:hidden">
          <a href="/articles" className="btn-outline">อ่านทั้งหมด</a>
        </div>
      </section>
    </>
  )
}
