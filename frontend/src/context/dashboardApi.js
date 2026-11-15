export const dashboardFields = {
  admin: ['students', 'companies', 'departments', 'pendingApplications', 'activeInternships', 'completedInternships'],
  student: ['applications', 'activeInternships', 'dailyReports', 'weeklyReports', 'evaluations'],
  academic_supervisor: ['assignedInternships', 'activeInternships', 'submittedDailyReports', 'submittedWeeklyReports', 'evaluations'],
  company_representative: ['companies', 'openOpportunities', 'activeInternships', 'completedInternships', 'evaluations'],
}

export async function fetchDashboardStats(token, role, signal) {
  if (typeof token !== 'string' || !token.trim()) {
    const error = new Error('Please sign in again.')
    error.status = 401
    throw error
  }
  const fields = dashboardFields[role]
  if (!Array.isArray(fields)) {
    throw new Error('Dashboard is not available for this account.')
  }

  const timeout = AbortSignal.timeout(15000)
  const response = await fetch('/api/v1/dashboard/stats', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })

  if (response.status === 401) {
    const error = new Error('Your session is no longer valid. Please sign in again.')
    error.status = 401
    throw error
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Dashboard is unavailable right now. Please try again.')
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    if (error.name === 'SyntaxError') {
      throw new Error('Dashboard returned invalid data. Please try again.')
    }
    throw error
  }
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.message || 'Unable to load dashboard statistics.')
  }

  const stats = result.data?.stats
  if (result.data?.role !== role || !stats || typeof stats !== 'object' || Array.isArray(stats)
    || fields.some((key) => !Number.isSafeInteger(stats[key]) || stats[key] < 0)) {
    throw new Error('Dashboard returned invalid data for your account. Please try again.')
  }

  return stats
}
