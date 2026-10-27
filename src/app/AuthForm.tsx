'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import type { ActionResult } from '@/lib/actions'

type Props = {
  mode: 'login' | 'register'
  action: (prev: unknown, form: FormData) => Promise<ActionResult>
  next: string | null
}

export default function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const suffix = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <>
      <form action={formAction} className="form">
        {next && <input type="hidden" name="next" value={next} />}
        {mode === 'register' && (
          <label>
            Name
            <input name="display_name" autoComplete="given-name" required maxLength={80} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
          />
        </label>
        {state && !state.ok && <p className="error">{state.error}</p>}
        <button className="btn btn-wide" disabled={pending}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        {mode === 'login' ? (
          <>
            New here? <Link href={`/register${suffix}`}>Create an account</Link>
          </>
        ) : (
          <>
            Already have one? <Link href={`/login${suffix}`}>Sign in</Link>
          </>
        )}
      </p>
    </>
  )
}
