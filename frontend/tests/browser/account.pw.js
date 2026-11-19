import { expect, test } from '@playwright/test'
import { fixtures, installMockApi, roles } from './mockApi.js'

async function openAccount(context, page, role = 'student') {
  const state = fixtures(role)
  await installMockApi(context, state)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible()
  return state
}

async function choosePhoto(page, { usePicker = false } = {}) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = '#17634b'
    context.fillRect(0, 0, 512, 256)
    context.fillStyle = '#dbeafe'
    context.fillRect(180, 35, 152, 186)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const file = {
    name: 'profile.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  }
  if (usePicker) {
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Change profile photo', exact: true }).press('Enter')
    await (await chooser).setFiles(file)
  } else await page.getByLabel('Profile photo', { exact: true }).setInputFiles(file)
  await expect(page.locator('main img')).toHaveCount(1)
  const image = page.locator('main img')
  await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBe(256)
  expect(await image.evaluate((element) => element.naturalHeight)).toBe(128)
  return image.getAttribute('src')
}

for (const role of roles) {
  test(role + ': edit account and photo, restore after refresh, and log in to own profile', async ({ context, page }) => {
    const state = await openAccount(context, page, role)
    const navbar = page.getByRole('link', { name: 'Open my account', exact: true })
    await expect(navbar.locator('img')).toHaveCount(0)
    await page.getByLabel('Full name', { exact: true }).fill('Updated ' + role)
    await page.getByLabel('Email address', { exact: true }).fill(role + '.updated@example.test')
    const image = await choosePhoto(page)
    await expect(navbar.locator('img')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save account', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Account saved successfully.' })).toBeVisible()
    await expect(navbar.locator('img')).toHaveAttribute('src', image)
    await expect.poll(() => navbar.locator('img').evaluate((element) => element.naturalWidth)).toBe(256)
    expect(state.users.find((user) => user.role === role).profileImage).toBe(image)
    expect(state.users.filter((user) => user.role !== role).every((user) => !user.profileImage)).toBe(true)
    await page.reload()
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Updated ' + role)
    await expect(navbar.locator('img')).toHaveAttribute('src', image)
    await page.goto('/dashboard')
    await navbar.click()
    await expect(page).toHaveURL(/\/account$/)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Email address', { exact: true }).fill(role + '.updated@example.test')
    await page.getByLabel('Password', { exact: true }).fill('Test-password-123')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(navbar.locator('img')).toHaveAttribute('src', image)
    expect(state.unexpected).toEqual([])
  })
}

test('photo preview resets without saving and photo removal persists', async ({ context, page }) => {
  const state = await openAccount(context, page)
  await choosePhoto(page)
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click()
  await expect(page.locator('main img')).toHaveCount(0)
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  await choosePhoto(page)
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Account saved' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await expect(page.locator('main img')).toHaveCount(0)
  await expect(page.locator('header img')).toHaveCount(1)
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.locator('header img')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible()
  await expect(page.locator('header img')).toHaveCount(0)
  expect(state.users.find((user) => user.role === 'student').profileImage).toBe('')
})

test('invalid photos and duplicate emails show errors without changing the saved account', async ({ context, page }) => {
  const state = await openAccount(context, page)
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(page.getByRole('alert')).toHaveText('Choose a JPG, PNG or WebP image.')
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toContainText('Unable to read this photo.')
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  await page.getByLabel('Full name', { exact: true }).fill('Changed name')
  await page.getByLabel('Email address', { exact: true }).fill('taken@example.test')
  state.failures.push({ path: '/auth/me', method: 'PATCH', status: 409, message: 'An account with this email already exists.' })
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('An account with this email already exists.')
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Changed name')
  expect(state.users.find((user) => user.role === 'student').name).toBe('Browser student')
  await expect(page.getByRole('button', { name: 'Save account', exact: true })).toBeEnabled()
})

test('expired account saves sign out and a broken saved photo uses the initial fallback', async ({ context, page }) => {
  const state = fixtures()
  state.users.find((user) => user.role === 'student').profileImage = 'data:image/jpeg;base64,/9j/4AAC/9k='
  await installMockApi(context, state)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible()
  await expect(page.locator('header img')).toHaveCount(0)
  await page.getByLabel('Full name', { exact: true }).fill('Changed name')
  state.failures.push({ path: '/auth/me', method: 'PATCH', status: 401 })
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
})

test('profile photo and fields fit mobile and desktop in both themes', async ({ context, page }, testInfo) => {
  await openAccount(context, page)
  await choosePhoto(page)
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Account saved' })).toBeVisible()
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const avatar = page.locator('header img')
      await expect(avatar).toHaveCSS('object-fit', 'cover')
      await expect.poll(() => avatar.evaluate((element) => element.naturalWidth)).toBe(256)
      await page.screenshot({ path: testInfo.outputPath('account-' + width + '-' + theme + '.png'), fullPage: true, animations: 'disabled' })
    }
  }
})

test('the photo button opens the native picker and a preview still requires an explicit save', async ({ context, page }) => {
  const state = await openAccount(context, page)
  await choosePhoto(page, { usePicker: true })
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await expect(page.locator('header img')).toHaveCount(0)
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click()
  await expect(page.locator('main img')).toHaveCount(0)
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
})

test('student profile navigation preserves the saved identity and academic workflow', async ({ context, page }) => {
  const state = await openAccount(context, page)
  const navigation = page.getByRole('navigation', { name: 'Profile sections', exact: true })
  await expect(navigation.getByRole('link', { name: 'My account', exact: true })).toHaveAttribute('aria-current', 'page')
  await navigation.getByRole('link', { name: 'Academic profile', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(navigation.getByRole('link', { name: 'Academic profile', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByLabel('Student number', { exact: true })).toHaveValue('CS-101')
  await page.getByLabel('Semester', { exact: true }).fill('7')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Profile saved successfully.' })).toBeVisible()
  await navigation.getByRole('link', { name: 'My account', exact: true }).click()
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('student@example.test')
  expect(state.profiles[0].semester).toBe(7)
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  expect(state.unexpected).toEqual([])
})

test('long profile identities, circular avatars and photo tooltips fit narrow screens', async ({ context, page }) => {
  const state = fixtures('company_representative')
  const user = state.users.find((user) => user.role === state.role)
  user.name = 'LongProfileName'.repeat(6)
  user.email = 'a'.repeat(64) + '@' + 'department'.repeat(5) + '.example.test'
  await installMockApi(context, state)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible()
  await choosePhoto(page)
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      for (const tip of await page.locator('main .tooltip[data-tip]').all()) {
        await tip.hover()
        await expect.poll(() => tip.evaluate((element) => Number(getComputedStyle(element, '::before').opacity))).toBe(1)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      }
      const avatar = page.locator('main img').locator('..')
      const dimensions = await avatar.boundingBox()
      expect(dimensions.width).toBe(dimensions.height)
      const radius = await avatar.evaluate((element) => parseFloat(getComputedStyle(element).borderRadius))
      expect(radius).toBeGreaterThanOrEqual(dimensions.width / 2)
    }
  }
})

test('academic details fit both themes and keep the student identity visible during a load failure', async ({ context, page }, testInfo) => {
  const state = fixtures()
  state.failures.push({ path: '/students/me', status: 503, persistent: true })
  await installMockApi(context, state)
  await page.goto('/profile')
  await expect(page.getByRole('alert')).toContainText('Unable to load profile')
  await expect(page.getByRole('complementary', { name: 'Profile identity', exact: true })).toContainText('student@example.test')
  state.failures = []
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByLabel('Student number', { exact: true })).toHaveValue('CS-101')
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      await page.mouse.move(0, 0)
      await page.screenshot({ path: testInfo.outputPath('academic-' + width + '-' + theme + '.png'), fullPage: true, animations: 'disabled' })
    }
  }
})
