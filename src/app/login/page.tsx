import { loginAction } from '@/lib/actions'
import AuthForm from '../AuthForm'

export const metadata = { title: 'Sign in · Ticket2Prize' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <section className="panel narrow">
      <h1>Sign in</h1>
      <AuthForm mode="login" action={loginAction} next={next ?? null} />
    </section>
  )
}
