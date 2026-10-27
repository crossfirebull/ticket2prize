import Kiosk from './Kiosk'

export const metadata = { title: 'Demo kiosk · Ticket2Prize' }

export default function KioskPage() {
  // Prefilled only in `next dev`; a deployed kiosk key must never be on a public page.
  return <Kiosk defaultKey={process.env.NODE_ENV === 'development' ? 'dev-kiosk-key' : ''} />
}
