import { Link, NavLink } from 'react-router-dom'
import { formatTickets } from '../api'
import { cartCount } from '../cart'
import { useSession } from '../session'
import TicketIcon from './TicketIcon'

export default function Header() {
  const { token, balance, account, cart } = useSession()
  const items = cartCount(cart)
  return (
    <header className="header">
      <Link to="/" className="brand">
        <TicketIcon /> Ticket<span>2</span>Prize
      </Link>
      <nav className="header-nav">
        {token && (
          <span className="balance" title="Your ticket balance" data-testid="balance">
            <TicketIcon /> {formatTickets(balance)}
          </span>
        )}
        <NavLink to="/cart" className="nav-link">
          Cart{items > 0 && <span className="badge">{items}</span>}
        </NavLink>
        <NavLink to={account ? '/account' : '/login'} className="nav-link">
          {account ? account.display_name : 'Sign in'}
        </NavLink>
      </nav>
    </header>
  )
}
