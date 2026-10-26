import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import AccountPage from './pages/AccountPage'
import CartPage from './pages/CartPage'
import ClaimPage from './pages/ClaimPage'
import KioskPage from './pages/KioskPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import NotFound from './pages/NotFound'
import OrderPage from './pages/OrderPage'
import StaffPage from './pages/StaffPage'
import StorePage from './pages/StorePage'

export default function App() {
  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/" element={<StorePage />} />
          <Route path="/claim/:code" element={<ClaimPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders/:id" element={<OrderPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        Ticket2Prize · <a href="/kiosk">Demo kiosk</a> · <a href="/staff">Prize counter</a>
      </footer>
    </>
  )
}
