import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, InternshipStatusForm, InternshipStatusFields, InternshipList, InternshipAssignmentFields, Internships, AuthContext, ThemeContext
const internship = { _id: '507f1f77bcf86cd799439017', status: 'assigned', student: { name: 'Student One', email: 'student@example.com' },
  supervisor: { name: 'Supervisor One', email: 'supervisor@example.com' }, company: { name: 'Example Company', address: 'Kabul' },
  opportunity: { title: 'Frontend Intern' }, startDate: '2026-12-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z' }
const change = { from: 'assigned', to: 'active', changedBy: '507f1f77bcf86cd799439015', changedAt: '2026-11-17T19:30:00.000Z', reason: 'Training started.' }
const defaults = { id: 'status-test', currentStatus: 'assigned', values: { status: '', reason: '' }, errors: {}, disabled: false, saving: false, onChange() {}, onSubmit() {} }
const listDefaults = { internships: [internship], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  const form = await server.ssrLoadModule('/src/components/InternshipStatusForm.jsx')
  InternshipStatusForm = form.default
  InternshipStatusFields = form.InternshipStatusFields
  InternshipList = (await server.ssrLoadModule('/src/components/InternshipList.jsx')).default
  InternshipAssignmentFields = (await server.ssrLoadModule('/src/components/InternshipAssignmentForm.jsx')).InternshipAssignmentFields
  Internships = (await server.ssrLoadModule('/src/pages/Internships.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })
function render(element, { role = 'admin', theme = 'light' } = {}) {
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/internships'] },
    h(AuthContext.Provider, { value: { user: { id: 'user-id', name: 'Test User', email: 'user@example.com', role }, token: 'test-token', signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element)))).replace(/\u202f/g, ' ')
}
function fields(props = {}) { return render(h(InternshipStatusFields, { ...defaults, ...props })) }
function list(props = {}) { return render(h(InternshipList, { ...listDefaults, ...props })) }

test('assigned and active forms offer only their valid next statuses without a default decision', () => {
  const assigned = fields()
  assert.match(assigned, /Choose a status/)
  assert.match(assigned, /value="active"/)
  assert.match(assigned, /value="cancelled"/)
  assert.doesNotMatch(assigned, /value="completed"|value="assigned"/)
  const active = fields({ currentStatus: 'active' })
  assert.match(active, /value="completed"/)
  assert.match(active, /value="cancelled"/)
  assert.doesNotMatch(active, /value="active"|value="assigned"/)
})

test('cancellation has a labelled required reason while other changes keep it optional', () => {
  const cancelled = fields({ values: { status: 'cancelled', reason: 'Placement ended by agreement.' } })
  assert.match(cancelled, /Cancellation reason/)
  assert.match(cancelled, /for="status-test-reason"/)
  assert.match(cancelled, /maxLength="1000" required=""/)
  assert.match(cancelled, /Placement ended by agreement/)
  const active = fields({ values: { status: 'active', reason: '' } })
  assert.match(active, /Reason \(optional\)/)
  assert.doesNotMatch(active.match(/<textarea\b[^>]*>/)[0], /required=/)
})

test('saving and external write locks disable the form and validation errors remain accessible', () => {
  const html = fields({ saving: true, errors: { status: 'Choose a status', reason: '<script>Reason required</script>' } })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /Saving/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /aria-describedby="status-test-reason-error"/)
  assert.match(html, /&lt;script&gt;Reason required&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(fields({ disabled: true }), /<fieldset disabled=""/)
})

test('terminal and unknown records have no editable status form', () => {
  for (const status of ['assigned', 'active']) {
    const html = render(h(InternshipStatusForm, { internship: { ...internship, status }, onSave() {} }))
    assert.match(html, /<details\b/)
    assert.match(html, /Update status/)
    assert.match(html, /Save status/)
    assert.doesNotMatch(html, /<details[^>]*\bopen=/)
  }
  for (const status of ['completed', 'cancelled', 'unknown', 'constructor']) {
    assert.equal(render(h(InternshipStatusForm, { internship: { ...internship, status }, onSave() {} })), '')
  }
})

test('selecting a new status does not autosave and Save forwards the explicit submit action', () => {
  const calls = []
  const tree = InternshipStatusFields({ ...defaults, onChange: (event) => calls.push(event.target.value), onSubmit: () => calls.push('save') })
  function find(node, type) {
    if (!node || typeof node !== 'object') return null
    if (node.type === type) return node
    return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean)
  }
  find(tree, 'select').props.onChange({ target: { value: 'active' } })
  assert.deepEqual(calls, ['active'])
  tree.props.onSubmit()
  assert.deepEqual(calls, ['active', 'save'])
})

test('history is a read-only native disclosure with real transitions, Kabul time and plain-text reasons', () => {
  const html = list({ internships: [{ ...internship, status: 'active', statusHistory: [change] }] })
  assert.match(html, /Status history/)
  assert.match(html, /Assigned to Active/)
  assert.match(html, /Training started/)
  assert.match(html, /Nov 18, 2026/)
  assert.match(html, /12:00 AM/)
  assert.match(html, /dateTime="2026-11-17T19:30:00.000Z"/)
  assert.match(html, /Kabul/)
  assert.doesNotMatch(html, new RegExp(change.changedBy))
  assert.doesNotMatch(html, /<details[^>]*\bopen=|Save status/)
})

test('empty and older records do not receive invented status history', () => {
  assert.doesNotMatch(list(), /Status history/)
  assert.doesNotMatch(list({ internships: [{ ...internship, statusHistory: [] }] }), /Status history/)
})

test('history shows cancellation reasons without unsafe markup or layout-specific colors', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(InternshipList, { ...listDefaults, internships: [{ ...internship, status: 'cancelled', statusHistory: [{ ...change, to: 'cancelled', reason: '<script>Reason</script>\n' + 'A'.repeat(900) }] }] }), { theme })
    assert.match(html, /Assigned to Cancelled/)
    assert.match(html, /&lt;script&gt;Reason&lt;\/script&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /whitespace-pre-wrap/)
    assert.doesNotMatch(html, /<script>|bg-white|text-black/)
  }
})

test('busy list controls are disabled while the actual internship stays visible', () => {
  const html = list({ disabled: true, page: 2, hasNextPage: true })
  assert.match(html, /aria-busy="true"/)
  for (const label of ['Refresh internships', 'Previous page', 'Next page']) assert.ok(html.includes(`disabled="" aria-label="${label}"`))
  assert.match(html, /Frontend Intern/)
})

test('the assignment form accepts the shared write lock while keeping existing values', () => {
  const html = render(h(InternshipAssignmentFields, { values: { applicationId: '', supervisorId: '', startDate: '2026-12-01', endDate: '2027-02-01' }, errors: {},
    applications: [], supervisors: [], loadingOptions: false, optionsError: '', saving: false, disabled: true, onChange() {}, onSubmit() {} }))
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /value="2026-12-01"/)
  assert.match(html, /value="2027-02-01"/)
})

test('only the admin page supplies status actions; students and supervisors retain read-only history', () => {
  function PageProbe() {
    const tree = Internships()
    const listElement = tree.props.children.find((child) => child?.type === InternshipList)
    return h(InternshipList, { ...listDefaults, internships: [{ ...internship, status: 'active', statusHistory: [change] }], renderActions: listElement.props.renderActions })
  }
  for (const role of ['admin', 'student', 'academic_supervisor']) {
    const html = render(h(PageProbe), { role })
    assert.match(html, /Status history/)
    if (role === 'admin') assert.match(html, /Save status/)
    else assert.doesNotMatch(html, /Update status|Save status|Internship status change/)
  }
})
