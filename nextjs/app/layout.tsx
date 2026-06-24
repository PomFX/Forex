import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'ATH Trader - Forex Trading Signals',
  description: 'รับสัญญาณเทรด Forex แม่นยำจากทีมวิเคราะห์ พร้อมโบรกเกอร์แนะนำและบทความให้ความรู้',
  openGraph: {
    title: 'ATH Trader - Forex Trading Signals',
    description: 'รับสัญญาณเทรด Forex แม่นยำจากทีมวิเคราะห์',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
