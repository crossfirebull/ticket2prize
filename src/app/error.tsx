'use client'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="panel center">
      <h1>Tilt!</h1>
      <p>Something went wrong on our side.</p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </section>
  )
}
