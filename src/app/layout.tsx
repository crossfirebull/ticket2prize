import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import CartLink from '@/components/CartLink'
import { CartProvider } from '@/components/CartProvider'
import TicketIcon from '@/components/TicketIcon'
import { formatTickets } from '@/lib/format'
import { getSession } from '@/lib/session'
import './globals.css'

// Every page shows the visitor's live balance, so nothing is prerendered at build time.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ticket2Prize',
  description: 'Trade your arcade tickets for prizes and skip the line.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = { themeColor: '#120c2c' }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Zen+Dots&display=swap"
        />
      </head>
      <body>
        <CartProvider>
          <header className="header">
            <Link href="/" className="brand">
              <TicketIcon /> Ticket<span>2</span>Prize
            </Link>
            <nav className="header-nav">
              {session && (
                <span className="balance" title="Your ticket balance" data-testid="balance">
                  <TicketIcon /> {formatTickets(session.balance)}
                </span>
              )}
              <CartLink />
              <Link href={session?.account ? '/account' : '/login'} className="nav-link">
                {session?.account ? session.account.displayName : 'Sign in'}
              </Link>
            </nav>
          </header>
          <main className="page">{children}</main>
          <footer className="footer">
            Ticket2Prize · <Link href="/kiosk">Demo kiosk</Link> · <Link href="/staff">Prize counter</Link>
          </footer>
        </CartProvider>
      </body>
    </html>
  )
}
