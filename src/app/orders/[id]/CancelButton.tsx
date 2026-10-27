'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cancelOrderAction } from '@/lib/actions'

export default function CancelButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        className="btn btn-ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelOrderAction(orderId)
            if (!result.ok) setError(result.error)
            router.refresh()
          })
        }
      >
        Cancel & refund
      </button>
      {error && <p className="error">{error}</p>}
    </>
  )
}
