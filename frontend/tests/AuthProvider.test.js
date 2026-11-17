import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let AuthProvider
let ThemeContext

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  AuthProvider = (await server.ssrLoadModule('/src/context/AuthProvider.jsx')).default
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function renderWithToken(t, token) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage: { getItem: () => token } },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else delete globalThis.window
  })
  return renderToStaticMarkup(h(ThemeContext.Provider, { value: { theme: 'light', toggleTheme() {} } },
    h(AuthProvider, null, h('p', null, 'Application routes'))))
}

test('without a saved token, application routes are rendered immediately', (t) => {
  const html = renderWithToken(t, null)
  assert.match(html, /Application routes/)
  assert.doesNotMatch(html, /Restoring your session/)
})

test('a saved token gates routes during verification without exposing the token in HTML', (t) => {
  const html = renderWithToken(t, 'private-access-token')
  assert.match(html, /Restoring your session/)
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /Application routes/)
  assert.doesNotMatch(html, /private-access-token/)
})
