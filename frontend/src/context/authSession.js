const sessionKey = 'sims-access-token'
const roles = ['student', 'admin', 'academic_supervisor', 'company_representative']

export function readSessionToken() {
  try {
    const token = window.sessionStorage.getItem(sessionKey)
    return typeof token === 'string' && token.trim() ? token : null
  } catch {
    return null
  }
}

export function saveSessionToken(token) {
  try {
    window.sessionStorage.setItem(sessionKey, token)
  } catch {
    // Sign-in still works in memory when browser storage is blocked.
  }
}

export function clearSessionToken() {
  try {
    window.sessionStorage.removeItem(sessionKey)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function isValidSessionUser(user) {
  return Boolean(user && typeof user.id === 'string' && user.id.trim()
    && typeof user.name === 'string' && user.name.trim()
    && typeof user.email === 'string' && user.email.trim()
    && roles.includes(user.role) && user.isActive === true)
}

export async function fetchSessionUser(token, signal) {
  const response = await fetch('/api/v1/auth/me', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })

  if (response.status === 401) {
    const error = new Error('Your session has expired. Please sign in again.')
    error.status = 401
    throw error
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Unable to check your session. Please try again.')
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    if (error.name === 'SyntaxError') {
      throw new Error('Unable to check your session. Please try again.')
    }
    throw error
  }
  if (!response.ok || result?.success !== true || !isValidSessionUser(result.data?.user)) {
    throw new Error('Unable to check your session. Please try again.')
  }

  return result.data.user
}
