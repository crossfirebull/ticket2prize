import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Session } from '../api'
import { useSession } from '../session'

function useAuthSubmit(path: string) {
  const { token, signIn } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = Object.fromEntries(new FormData(e.currentTarget))
    try {
      // Sending the guest token lets the server move the guest's tickets onto the account.
      signIn(await api<Session>(path, { body, token }))
      navigate(params.get('next') ?? '/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { submit, error, busy, next: params.get('next') }
}

export function LoginPage() {
  const { submit, error, busy, next } = useAuthSubmit('/api/auth/login')
  return (
    <section className="panel narrow">
      <h1>Sign in</h1>
      <form onSubmit={submit} className="form">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-wide" disabled={busy}>
          Sign in
        </button>
      </form>
      <p className="muted">
        New here? <Link to={`/register${next ? `?next=${next}` : ''}`}>Create an account</Link>
      </p>
    </section>
  )
}

export function RegisterPage() {
  const { submit, error, busy, next } = useAuthSubmit('/api/auth/register')
  const { token, balance, account } = useSession()
  return (
    <section className="panel narrow">
      <h1>Create an account</h1>
      {token && !account && balance > 0 && (
        <p>Your {balance.toLocaleString('en-US')} tickets will be saved to your new account.</p>
      )}
      <form onSubmit={submit} className="form">
        <label>
          Name
          <input name="display_name" autoComplete="given-name" required maxLength={80} />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-wide" disabled={busy}>
          Create account
        </button>
      </form>
      <p className="muted">
        Already have one? <Link to={`/login${next ? `?next=${next}` : ''}`}>Sign in</Link>
      </p>
    </section>
  )
}
