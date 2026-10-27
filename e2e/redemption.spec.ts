import { expect, test, type Page } from '@playwright/test'

// Against a deployment, set E2E_KIOSK_KEY (and E2E_STAFF_* for the counter test).
const KIOSK_KEY = process.env.E2E_KIOSK_KEY ?? 'dev-kiosk-key'
const STAFF = process.env.E2E_STAFF_EMAIL
  ? { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD ?? '' }
  : null

/** Print a stub at the demo kiosk, as a customer would get from the ticket machine. */
async function printStub(page: Page, tickets: string) {
  await page.goto('/kiosk')
  await page.getByLabel('Tickets counted').fill(tickets)
  await page.getByLabel('Kiosk key').fill(KIOSK_KEY)
  await page.getByRole('button', { name: 'Print stub' }).click()
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
  return (await page.locator('.stub-link').getAttribute('href'))!
}

async function claimAsGuest(page: Page, tickets: string) {
  const url = new URL(await printStub(page, tickets))
  await page.goto(url.pathname) // claim URLs use PUBLIC_BASE_URL; stay on the server under test
  await page.getByRole('button', { name: 'Add tickets & shop' }).click()
  await expect(page.getByText(/^\+/)).toBeVisible()
}

test('scan a stub, shop, check out and see the pickup code', async ({ page }) => {
  await claimAsGuest(page, '1000')
  await expect(page.getByTestId('balance')).toHaveText(/1,000/)

  await page.getByRole('link', { name: 'Start shopping' }).click()
  await page.getByRole('button', { name: 'Add Pokemon - Pikachu Plushie to cart' }).click()
  await page.getByRole('button', { name: 'Add Tootsie Roll to cart' }).click()
  await page.getByRole('button', { name: 'Add Tootsie Roll to cart' }).click()
  await expect(page.getByText('2 in cart')).toBeVisible()

  await page.getByRole('link', { name: /Cart/ }).click()
  await expect(page.getByText('Left after checkout')).toBeVisible()
  await page.getByRole('button', { name: 'Check out' }).click()

  await expect(page.getByLabel('Pickup code')).toHaveText(/^[2-9A-Z]{6}$/)
  await expect(page.getByTestId('balance')).toHaveText(/240/)
  await expect(page.getByRole('link', { name: 'Cart' })).toHaveText('Cart') // emptied

  // Nothing on the page should force sideways scrolling on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Put the prizes back, so repeated runs against a deployment don't drain its stock.
  await page.getByRole('button', { name: 'Cancel & refund' }).click()
  await expect(page.getByTestId('balance')).toHaveText(/1,000/)
})

test('a stub only works once', async ({ page, browser }) => {
  const url = new URL(await printStub(page, '50'))
  await page.goto(url.pathname)
  await page.getByRole('button', { name: 'Add tickets & shop' }).click()
  await expect(page.getByText('+50')).toBeVisible()

  const other = await browser.newPage()
  await other.goto(url.pathname)
  await expect(other.getByText('Already redeemed')).toBeVisible()
  await other.close()
})

test('cancelling an order refunds the tickets', async ({ page }) => {
  await claimAsGuest(page, '100')
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Tootsie Roll to cart' }).click()
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Check out' }).click()
  await expect(page.getByTestId('balance')).toHaveText(/95/)
  await page.getByRole('button', { name: 'Cancel & refund' }).click()
  await expect(page.getByText('Order cancelled, tickets refunded')).toBeVisible()
  await expect(page.getByTestId('balance')).toHaveText(/100/)
})

test('a guest who signs up keeps their tickets', async ({ page }) => {
  await claimAsGuest(page, '300')
  await page.getByRole('link', { name: 'Save them for next time' }).click()
  await expect(page.getByText('Your 300 tickets will be saved')).toBeVisible()
  await page.getByLabel('Name').fill('Sam')
  await page.getByLabel('Email').fill(`sam-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`)
  await page.getByLabel('Password').fill('correct-horse')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('link', { name: 'Sam' }).click()
  await expect(page.getByText('You have 300 tickets saved.')).toBeVisible()
})

test('counter staff hand over an order', async ({ page, browser }) => {
  test.skip(!STAFF, 'Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD to run')
  await claimAsGuest(page, '100')
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Tootsie Roll to cart' }).click()
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Check out' }).click()
  const code = (await page.getByLabel('Pickup code').textContent())!

  const counter = await browser.newPage()
  await counter.goto('/login?next=/staff')
  await counter.getByLabel('Email').fill(STAFF!.email)
  await counter.getByLabel('Password').fill(STAFF!.password)
  await counter.getByRole('button', { name: 'Sign in' }).click()
  await counter.getByLabel('Pickup code').fill(code.toLowerCase())
  await counter.getByRole('button', { name: 'Find order' }).click()
  await expect(counter.getByText('1 × Tootsie Roll')).toBeVisible()
  await counter.getByRole('button', { name: 'Hand over prizes' }).click()
  await expect(counter.getByText(`Order ${code} handed over.`)).toBeVisible()
  await counter.close()

  await page.reload()
  await expect(page.getByText('Enjoy your prizes!')).toBeVisible()
})
