import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './session'

type Handler = (init: RequestInit | undefined) => unknown

/** Stub fetch with "METHOD /path" -> response body handlers. */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    if (!(key in routes)) return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
    const route = routes[key]
    const body = typeof route === 'function' ? (route as Handler)(init) : route
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function renderAt(path: string, routePath: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
}
