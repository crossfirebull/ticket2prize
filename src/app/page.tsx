import Link from 'next/link'
import { listPrizes } from '@/lib/catalog'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/session'
import Store from './Store'

export default async function StorePage() {
  const [prizes, session] = await Promise.all([listPrizes(getDb()), getSession()])
  return (
    <>
      {!session && (
        <section className="hero">
          <h1>Trade your tickets for prizes, skip the line.</h1>
          <p>
            Scan the QR code on your ticket stub to load your tickets, pick your prizes here, then grab them at the
            counter with your pickup code.
          </p>
          <p className="hero-hint">
            No stub handy? Print one at the <Link href="/kiosk">demo kiosk</Link>.
          </p>
        </section>
      )}
      <Store prizes={prizes} balance={session?.balance ?? null} />
    </>
  )
}
