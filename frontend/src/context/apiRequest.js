export async function apiRequest(path, token, { method = 'GET', values, signal } = {}) {
  if (typeof token !== 'string' || !token.trim()) {
    const error = new Error('Please sign in again.')
    error.status = 401
    throw error
  }
  const timeout = AbortSignal.timeout(15000)
  const response = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json', Authorization: `Bearer ${token}`,
      ...(values ? { 'Content-Type': 'application/json' } : {}),
    },
    body: values ? JSON.stringify(values) : undefined,
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (response.status === 401) {
    const error = new Error('Your session has expired. Please sign in again.')
    error.status = 401
    throw error
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The service is unavailable right now. Please try again.')
  }
  let result
  try {
    result = await response.json()
  } catch (error) {
    if (error.name === 'SyntaxError') throw new Error('The server returned invalid data. Please try again.')
    throw error
  }
  if (!response.ok || result?.success !== true) {
    const error = new Error(result?.message || 'Unable to complete the request. Please try again.')
    error.status = response.status
    throw error
  }
  if (method !== 'GET' && !path.startsWith('/api/v1/inbox') && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('sims:inbox-refresh'))
  }
  return result
}
