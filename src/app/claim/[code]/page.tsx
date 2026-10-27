import Link from 'next/link'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/session'
import { previewStub } from '@/lib/stubs'
import ClaimButton from './ClaimButton'

export const metadata = { title: 'Your tickets · Ticket2Prize' }

export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [stub, session] = await Promise.all([previewStub(getDb(), code), getSession()])

  if (!stub) {
    return (
      <section className="panel center">
        <p className="error">We couldn&apos;t find that ticket stub.</p>
        <Link className="btn" href="/">
          Browse prizes
        </Link>
      </section>
    )
  }

  return (
    <section className="panel center">
      <ClaimButton
        code={code}
        tickets={stub.tickets}
        alreadyClaimed={stub.claimed}
        accountName={session?.account?.displayName ?? null}
      />
    </section>
  )
}
