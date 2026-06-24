'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/accounts', label: 'ประเภทบัญชี' },
  { href: '/signals', label: 'สัญญาณเทรด' },
  { href: '/articles', label: 'บทความ' },
  { href: '/brokers', label: 'โบรกเกอร์' },
  { href: '/contact', label: 'ติดต่อ' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <span className="text-gold-400">&#9650;</span>
            <span className="text-white">ATH</span>
            <span className="text-gold-400">Trader</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-gold-400 bg-gold-500/10'
                    : 'text-gray-300 hover:text-white hover:bg-navy-700/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="ml-3 flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 rounded-lg hover:from-gold-300 hover:to-gold-400 transition-all shadow-lg shadow-gold-500/20"
              >
                สมัครสมาชิก
              </Link>
            </div>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg hover:bg-navy-700 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-navy-800/95 backdrop-blur-xl border-t border-navy-700 animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-gold-400 bg-gold-500/10'
                    : 'text-gray-300 hover:text-white hover:bg-navy-700/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-navy-700 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white text-center"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-semibold bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 rounded-lg text-center"
              >
                สมัครสมาชิก
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
