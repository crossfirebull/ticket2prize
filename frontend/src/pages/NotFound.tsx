import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="panel center">
      <h1>Game over</h1>
      <p>That page doesn't exist.</p>
      <Link className="btn" to="/">
        Back to the prizes
      </Link>
    </section>
  )
}
