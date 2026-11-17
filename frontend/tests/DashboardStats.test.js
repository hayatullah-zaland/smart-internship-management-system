import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { dashboardFields } from '../src/context/dashboardApi.js'

let server
let DashboardStats

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  DashboardStats = (await server.ssrLoadModule('/src/components/DashboardStats.jsx')).default
})
after(async () => { await server?.close() })

function render(props) {
  return renderToStaticMarkup(createElement(DashboardStats, props))
}

for (const [role, fields] of Object.entries(dashboardFields)) {
  test(`${role} sees exactly the expected counters including real zeros`, () => {
    const stats = Object.fromEntries(fields.map((key) => [key, 0]))
    const html = render({ role, stats, loading: false, error: '', onRefresh() {} })
    assert.equal((html.match(/<dt\b/g) || []).length, fields.length)
    assert.equal((html.match(/>0<\/dd>/g) || []).length, fields.length)
    assert.match(html, /aria-busy="false"/)
    assert.doesNotMatch(html, /role="alert"/)
    if (role === 'student') assert.doesNotMatch(html, />Students<|>Companies</)
    if (role === 'admin') assert.doesNotMatch(html, />Daily reports<|>Weekly reports</)
  })
}

test('loading announces progress and shows placeholders rather than fake zero counts', () => {
  const html = render({ role: 'student', stats: null, loading: true, error: '', onRefresh() {} })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status"/)
  assert.match(html, /Loading dashboard statistics/)
  assert.match(html, /disabled=""/)
  assert.doesNotMatch(html, /<dd\b/)
  assert.equal((html.match(/min-h-36/g) || []).length, 5)
})

test('errors are escaped, announced and offer a retry without old counters', () => {
  const html = render({ role: 'student', stats: null, loading: false, error: '<script>Failure</script>', onRefresh() {} })
  assert.match(html, /role="alert"/)
  assert.match(html, /&lt;script&gt;Failure&lt;\/script&gt;/)
  assert.match(html, /Retry/)
  assert.doesNotMatch(html, /<script>|<dd\b/)
})

test('very large counters are compact but retain their full accessible value', () => {
  const stats = { students: Number.MAX_SAFE_INTEGER, companies: 1234, departments: 1, pendingApplications: 0, activeInternships: 1, completedInternships: 0 }
  const html = render({ role: 'admin', stats, loading: false, error: '', onRefresh() {} })
  assert.match(html, /aria-label="9,007,199,254,740,991"/)
  assert.match(html, /title="9,007,199,254,740,991"/)
  assert.match(html, /1,234<\/dd>/)
  assert.ok(html.includes(Number.MAX_SAFE_INTEGER.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })))
})

test('refresh and retry both use the supplied action', () => {
  let calls = 0
  const tree = DashboardStats({ role: 'student', stats: null, loading: false, error: 'Unavailable', onRefresh: () => { calls += 1 } })
  function buttons(node) {
    if (!node || typeof node !== 'object') return []
    return [...(node.type === 'button' ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons)]
  }
  const actions = buttons(tree)
  assert.equal(actions.length, 2)
  for (const action of actions) action.props.onClick()
  assert.equal(calls, 2)
})
