'use client'
import { useState, useTransition } from 'react'
import { restockAction, staffOrderAction } from '@/lib/actions'

/** Stays mounted after the order closes, so the confirmation survives the page refresh. */
export function OrderActions({ orderId, open }: { orderId: string; open: boolean }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const act = (action: 'fulfill' | 'cancel') =>
    startTransition(async () => {
      const result = await staffOrderAction(orderId, action)
      setMessage(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error })
    })

  return (
    <>
      {open && (
        <div className="actions">
          <button className="btn" disabled={pending} onClick={() => act('fulfill')}>
            Hand over prizes
          </button>
          <button className="btn btn-ghost" disabled={pending} onClick={() => act('cancel')}>
            Cancel & refund
          </button>
        </div>
      )}
      {message && <p className={message.ok ? 'notice' : 'error'}>{message.text}</p>}
    </>
  )
}

export function RestockButton({ prizeId, stock }: { prizeId: number; stock: number }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      className="btn btn-small"
      disabled={pending}
      onClick={() => startTransition(async () => void (await restockAction(prizeId, stock + 10)))}
    >
      +10
    </button>
  )
}
