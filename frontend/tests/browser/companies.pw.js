import { expect, test } from '@playwright/test'
import { fixtures, installMockApi } from './mockApi.js'

const id = (number) => number.toString(16).padStart(24, '0')
const records = (page) => page.getByRole('article')

async function openCompanies(context, page) {
  const state = fixtures('admin')
  const original = state.companies[0]
  const inactive = { ...state.users.find((user) => user.role === 'company_representative'),
    _id: id(204), name: 'Inactive Representative', email: 'inactive@example.test', isActive: false }
  state.users.push(inactive)
  state.companies = [
    { ...original, name: 'Kabul Technology Company' },
    { ...original, _id: id(201), name: 'Engineering Partnership', contactEmail: 'engineering@example.test', address: 'Herat, Afghanistan', representative: null },
    { ...original, _id: id(202), name: 'Health Services Company', contactEmail: 'health@example.test', address: 'Mazar-e-Sharif, Afghanistan', representative: inactive._id },
    { ...original, _id: id(203), name: 'Agriculture Training Company', contactEmail: 'agriculture@example.test', address: 'Kandahar, Afghanistan', representative: id(299) },
  ]
  await installMockApi(context, state)
  await page.goto('/admin/companies')
  await expect(page.getByRole('heading', { name: 'Companies', exact: true })).toBeVisible()
  await expect(page.getByText('Loading companies...', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Loading representatives...', { exact: true })).toHaveCount(0)
  await expect(records(page)).toHaveCount(4)
  return state
}

test('each company has its own card, real information and accurate representative state', async ({ context, page }) => {
  const state = await openCompanies(context, page)
  for (const company of state.companies) {
    const card = page.getByRole('article', { name: company.name, exact: true })
    await expect(card.getByRole('heading', { name: company.name, exact: true })).toBeVisible()
    await expect(card).toContainText(company.contactEmail)
    await expect(card).toContainText(company.address)
    await expect(card).toContainText(company._id)
    await expect(card.getByRole('form', { name: 'Representative for ' + company.name, exact: true })).toHaveCount(1)
  }
  await expect(page.getByRole('article', { name: 'Engineering Partnership', exact: true })).toContainText('Not assigned')
  await expect(page.getByRole('article', { name: 'Health Services Company', exact: true })).toContainText('Inactive account')
  await expect(page.getByRole('article', { name: 'Agriculture Training Company', exact: true })).toContainText('Representative account unavailable')
  expect(state.calls.every((call) => call.method === 'GET')).toBe(true)
  expect(state.unexpected).toEqual([])
})

test('assignment and replacement save only the chosen card and retain pending locks', async ({ context, page }) => {
  const state = await openCompanies(context, page)
  const target = state.companies[1]
  const originalOwner = state.companies[0].representative
  const owner = state.users.find((user) => user.role === 'company_representative' && user.isActive)
  let card = page.getByRole('article', { name: target.name, exact: true })
  await card.getByLabel('Representative', { exact: true }).selectOption(owner._id)
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  let release
  state.holdWrites = new Promise((resolve) => { release = resolve })
  try {
    await card.getByRole('button', { name: 'Assign representative', exact: true }).click()
    await expect(page.getByRole('button', { name: 'New company', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Refresh companies and representatives', exact: true })).toBeDisabled()
    for (const select of await records(page).getByRole('combobox').all()) await expect(select).toBeDisabled()
  } finally { release(); state.holdWrites = null }
  await expect(page.getByRole('status').filter({ hasText: 'assigned to Engineering Partnership' })).toBeVisible()
  await expect(card).toContainText(owner.email)
  expect(target.representative).toBe(owner._id)
  expect(state.companies[0].representative).toBe(originalOwner)
  const replacement = { ...owner, _id: id(300), name: 'Second Representative', email: 'second@example.test' }
  state.users.push(replacement)
  await page.getByRole('button', { name: 'Refresh companies and representatives', exact: true }).click()
  card = page.getByRole('article', { name: target.name, exact: true })
  await expect(card.getByLabel('New representative', { exact: true }).getByRole('option', { name: /Second Representative/ })).toHaveCount(1)
  await card.getByLabel('New representative', { exact: true }).selectOption(replacement._id)
  await expect(card).toContainText('This replaces the current representative.')
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1)
  await card.getByRole('button', { name: 'Replace representative', exact: true }).click()
  await expect(card).toContainText(replacement.email)
  expect(state.companies[0].representative).toBe(originalOwner)
  expect(state.calls.filter((call) => call.method === 'PATCH').map((call) => call.path)).toEqual([
    '/companies/' + target._id + '/representative', '/companies/' + target._id + '/representative',
  ])
})

test('lookup failures preserve cards without invented representatives and directory failures offer retry', async ({ context, page }) => {
  const state = await openCompanies(context, page)
  state.failures.push({ path: '/users', method: 'GET', status: 503, persistent: true })
  await page.getByRole('button', { name: 'Refresh companies and representatives', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load representatives')
  await expect(records(page)).toHaveCount(4)
  await expect(page.getByRole('article', { name: 'Kabul Technology Company', exact: true })).toContainText('Representative details unavailable')
  for (const select of await records(page).getByRole('combobox').all()) await expect(select).toBeDisabled()
  state.failures = [{ path: '/companies', method: 'GET', status: 503, persistent: true }]
  await page.getByRole('button', { name: 'Refresh companies and representatives', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load companies')
  await expect(records(page)).toHaveCount(0)
  state.failures = []
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(records(page)).toHaveCount(4)
})

test('the new-company command focuses the existing form and creation adds a separate card', async ({ context, page }) => {
  const state = await openCompanies(context, page)
  await page.getByRole('button', { name: 'New company', exact: true }).click()
  await expect(page.getByLabel('Company name', { exact: true })).toBeFocused()
  await page.getByLabel('Company name', { exact: true }).fill('New Training Partner')
  await page.getByLabel('Contact email', { exact: true }).fill('new.partner@example.test')
  await page.getByLabel('Address', { exact: true }).fill('Jalalabad, Afghanistan')
  await page.getByRole('button', { name: 'Create company', exact: true }).click()
  await expect(records(page)).toHaveCount(5)
  await expect(page.getByRole('article', { name: 'New Training Partner', exact: true })).toContainText('Not assigned')
  await expect(page.getByLabel('Company name', { exact: true })).toHaveValue('')
  expect(state.calls.filter((call) => call.method === 'POST' && call.path === '/companies')).toHaveLength(1)
})

test('company cards are distinct and fit both themes on mobile, tablet and desktop', async ({ context, page }, testInfo) => {
  const state = await openCompanies(context, page)
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const form = await page.locator('section[aria-labelledby="new-company-heading"]').boundingBox()
      const list = await page.locator('section[aria-labelledby="companies-heading"]').boundingBox()
      expect(form.y + form.height).toBeLessThanOrEqual(list.y)
      const inactiveColors = await page.getByText('Inactive account', { exact: true }).evaluate((element) => ({
        label: getComputedStyle(element).color, card: getComputedStyle(element.closest('article')).color,
      }))
      expect(inactiveColors.label).toBe(inactiveColors.card)
      const bounds = await records(page).evaluateAll((cards) => cards.map((card) => {
        const rect = card.getBoundingClientRect()
        const style = getComputedStyle(card)
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width,
          radius: parseFloat(style.borderRadius), border: parseFloat(style.borderTopWidth) }
      }))
      expect(bounds.every((box) => box.width > 0 && box.x >= 0 && box.right <= width && box.radius <= 8 && box.border > 0)).toBe(true)
      if (width === 1440) {
        expect(bounds[0].y).toBe(bounds[1].y)
        expect(bounds[0].right).toBeLessThan(bounds[1].x)
      } else expect(bounds[0].bottom).toBeLessThan(bounds[1].y)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.mouse.move(0, 0)
      await page.screenshot({ path: testInfo.outputPath('companies-' + width + '-' + theme + '.png'), fullPage: true, animations: 'disabled' })
    }
  }
  state.companies[0].name = 'LongCompanyName'.repeat(10)
  state.companies[0].address = 'A'.repeat(300)
  state.companies[0].contactEmail = 'a'.repeat(64) + '@' + 'department'.repeat(10) + '.example.test'
  await page.getByRole('button', { name: 'Refresh companies and representatives', exact: true }).click()
  await expect(page.getByRole('heading', { name: state.companies[0].name, exact: true })).toBeVisible()
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    const outside = await page.locator('.company-record').evaluateAll((cards) => cards.flatMap((card) => [...card.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect()
      const parent = card.getBoundingClientRect()
      return rect.width && (rect.left < parent.left - 1 || rect.right > parent.right + 1)
    }).map((element) => element.tagName)))
    expect(outside).toEqual([])
  }
})
