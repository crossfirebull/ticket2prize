import { registerAction } from '@/lib/actions'
import { formatTickets } from '@/lib/format'
import { getSession } from '@/lib/session'
import AuthForm from '../AuthForm'

export const metadata = { title: 'Create an account · Ticket2Prize' }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, session] = await Promise.all([searchParams, getSession()])
  return (
    <section className="panel narrow">
      <h1>Create an account</h1>
      {session && !session.account && session.balance > 0 && (
        <p>Your {formatTickets(session.balance)} tickets will be saved to your new account.</p>
      )}
      <AuthForm mode="register" action={registerAction} next={next ?? null} />
    </section>
  )
}
