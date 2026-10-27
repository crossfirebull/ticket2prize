import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="panel center">
      <h1>Game over</h1>
      <p>That page doesn&apos;t exist.</p>
      <Link className="btn" href="/">
        Back to the prizes
      </Link>
    </section>
  )
}
