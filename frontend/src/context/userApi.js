import { apiRequest } from './apiRequest.js'

export const USER_ROLES = {
  student: 'Student',
  academic_supervisor: 'Academic supervisor',
  company_representative: 'Company representative',
  admin: 'Administrator',
}
export const USERS_PAGE_SIZE = 10
export const MAX_USERS_PAGE = 1000000
const isId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const sameId = (a, b) => isId(a) && isId(b) && a.toLowerCase() === b.toLowerCase()
const isRole = (value) => typeof value === 'string' && Object.hasOwn(USER_ROLES, value)
const isEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isUser = (user, id) => isId(id) && typeof user?.name === 'string' && user.name.trim().length >= 2
  && user.name.length <= 100 && isEmail(user.email) && isRole(user.role) && typeof user.isActive === 'boolean'

function accountDetails(user, id) {
  return { id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }
}

export function validateManagedUser(values) {
  const errors = validateManagedUserDetails(values)
  if (!isRole(values?.role)) errors.role = 'Choose an account role.'
  if (typeof values?.password !== 'string' || values.password.length < 8 || new TextEncoder().encode(values.password).length > 72) {
    errors.password = 'Use at least 8 characters and no more than 72 UTF-8 bytes.'
  }
  if (typeof values?.confirmPassword !== 'string' || !values.confirmPassword || values.confirmPassword !== values.password) {
    errors.confirmPassword = 'The passwords must match.'
  }
  return errors
}

export function validateManagedUserDetails(values) {
  const errors = {}
  if (typeof values?.name !== 'string' || values.name.trim().length < 2 || values.name.trim().length > 100) {
    errors.name = 'Enter a name between 2 and 100 characters.'
  }
  if (typeof values?.email !== 'string' || !isEmail(values.email.trim())) errors.email = 'Enter a valid email address.'
  return errors
}

export async function updateManagedUser(token, account, values, signal) {
  if (!isUser(account, account?.id) || account.role === 'admin') throw new Error('Administrator accounts are protected.')
  const errors = validateManagedUserDetails(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const body = { name: values.name.trim(), email: values.email.trim().toLowerCase() }
  const result = await apiRequest(`/api/v1/users/${account.id}`, token, { method: 'PATCH', values: body, signal })
  const user = result.data?.user
  if (!isUser(user, user?.id) || !sameId(user.id, account.id) || user.role !== account.role || user.isActive !== account.isActive
    || user.name !== body.name || user.email !== body.email) {
    throw new Error('The update could not be confirmed. Refresh users before trying again.')
  }
  return accountDetails(user, user.id)
}

export async function deleteManagedUser(token, account, signal) {
  if (!isUser(account, account?.id) || account.role === 'admin') throw new Error('Administrator accounts are protected.')
  if (account.isActive) throw new Error('Deactivate this account before deleting it.')
  const result = await apiRequest(`/api/v1/users/${account.id}`, token, { method: 'DELETE', signal })
  if (!sameId(result.data?.userId, account.id)) {
    throw new Error('Deletion could not be confirmed. Refresh users before trying again.')
  }
  return account.id
}

export async function fetchManagedUsers(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_USERS_PAGE) throw new Error('Choose a valid users page.')
  const result = await apiRequest(`/api/v1/users?page=${page}&limit=${USERS_PAGE_SIZE}`, token, { signal })
  const users = result.data?.users
  if (!Array.isArray(users) || result.data.page !== page || result.data.limit !== USERS_PAGE_SIZE || users.length > USERS_PAGE_SIZE
    || users.some((user) => !isUser(user, user?._id) || typeof user.createdAt !== 'string' || !Number.isFinite(Date.parse(user.createdAt)))
    || new Set(users.map((user) => user._id.toLowerCase())).size !== users.length) {
    throw new Error('The server returned invalid user data. Please refresh users.')
  }
  return { users: users.map((user) => ({ ...accountDetails(user, user._id), createdAt: user.createdAt })),
    hasNextPage: users.length === USERS_PAGE_SIZE && page < MAX_USERS_PAGE }
}

export async function createManagedUser(token, values, signal) {
  const errors = validateManagedUser(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const body = { name: values.name.trim(), email: values.email.trim().toLowerCase(), password: values.password, role: values.role }
  const result = await apiRequest('/api/v1/auth/create-user', token, { method: 'POST', values: body, signal })
  const user = result.data?.user
  if (!isUser(user, user?.id) || user.name !== body.name || user.email !== body.email || user.role !== body.role || !user.isActive) {
    throw new Error('The new account could not be confirmed. Refresh users before trying again.')
  }
  return accountDetails(user, user.id)
}

export async function updateManagedUserStatus(token, account, isActive, signal) {
  if (!isUser(account, account?.id) || account.role === 'admin') throw new Error('Administrator account status cannot be changed here.')
  if (typeof isActive !== 'boolean' || isActive === account.isActive) throw new Error('Choose a different account status.')
  const result = await apiRequest(`/api/v1/users/${account.id}/status`, token, { method: 'PATCH', values: { isActive }, signal })
  const user = result.data?.user
  if (!isUser(user, user?.id) || !sameId(user.id, account.id) || user.role !== account.role || user.isActive !== isActive) {
    throw new Error('The status change could not be confirmed. Refresh users before trying again.')
  }
  return accountDetails(user, user.id)
}
