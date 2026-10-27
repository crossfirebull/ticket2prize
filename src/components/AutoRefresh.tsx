'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Re-fetch the server-rendered page every few seconds (pickup status, staff queue). */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(timer)
  }, [router, seconds])
  return null
}
