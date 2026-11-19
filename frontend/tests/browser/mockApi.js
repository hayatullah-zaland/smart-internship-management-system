import { dashboardFields } from '../../src/context/dashboardApi.js'
import { getWeeklyReportDates } from '../../src/context/weeklyReportApi.js'

const id = (number) => number.toString(16).padStart(24, '0')
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const stamp = (offset = 0) => `${day(offset)}T00:00:00.000Z`
export const roles = ['admin', 'student', 'academic_supervisor', 'company_representative']
export const routes = {
  admin: ['/dashboard', '/account', '/departments', '/admin/users', '/admin/students', '/admin/companies', '/opportunities', '/admin/applications', '/internships', '/daily-reports', '/weekly-reports', '/evaluations'],
  student: ['/dashboard', '/account', '/profile', '/opportunities', '/applications', '/internships', '/daily-reports', '/weekly-reports', '/evaluations'],
  academic_supervisor: ['/dashboard', '/account', '/opportunities', '/internships', '/daily-reports', '/evaluations'],
  company_representative: ['/dashboard', '/account', '/opportunities', '/evaluations'],
}

export function fixtures(role = 'student') {
  const users = roles.map((value, index) => ({ _id: id(index + 1), name: `Browser ${value.replaceAll('_', ' ')}`, email: `${value}@example.test`, role: value, isActive: true, createdAt: stamp() }))
  const department = { _id: id(10), name: 'Computer Science and Information Systems', code: 'CS' }
  const company = { _id: id(20), name: 'Browser Test Technology Company', address: 'Kabul, Afghanistan', contactEmail: 'company@example.test', representative: id(4), createdBy: id(1), createdAt: stamp() }
  const opportunities = [30, 31, 32].map((number) => ({ _id: id(number), title: `Software development internship ${number}`, description: 'Build and test accessible web applications. '.repeat(8), company: company._id, createdBy: id(4), deadline: '2099-12-31T12:00:00.000Z', capacity: 10, status: 'open', createdAt: stamp() }))
  const applications = ['pending', 'approved', 'approved'].map((status, index) => ({ _id: id(40 + index), student: id(2), opportunity: opportunities[index]._id, status, rejectionReason: '', createdAt: stamp() }))
  const internships = ['active', 'completed'].map((status, index) => ({ _id: id(50 + index), application: applications[index + 1]._id, student: id(2), supervisor: id(3), company: company._id, opportunity: opportunities[index + 1]._id, createdBy: id(1), status, isOngoing: status === 'active', startDate: stamp(-14), endDate: stamp(index ? -1 : 14), statusHistory: [] }))
  const daily = { _id: id(60), student: id(2), internship: id(50), date: stamp(-1), hours: 4, tasks: 'Test the application', learning: 'Write clear reports', challenges: '', status: 'draft', feedback: '', submittedAt: null, reviewedBy: null, reviewedAt: null }
  const weekly = { _id: id(70), student: id(2), internship: id(50), weekNumber: 1, ...getWeeklyReportDates(internships[0], 1), summary: 'Completed the first internship week', learning: 'Teamwork and testing', challenges: '', status: 'draft', submittedAt: null }
  return {
    role, signedInUserId: users.find((user) => user.role === role)._id, users, departments: [department], companies: [company], opportunities, applications, internships,
    profiles: [{ _id: id(90), user: id(2), department: id(10), studentNumber: 'CS-101', semester: 4, phone: '+93700123456' }],
    dailyReports: [daily], weeklyReports: [weekly], evaluations: [], calls: [], unexpected: [], failures: [],
    today: day(), nextId: 100,
  }
}

export async function installMockApi(context, state, { signedIn = true, theme = 'light' } = {}) {
  await context.addInitScript(({ signedIn, theme }) => {
    // Seed once per tab, so logout and reload cannot silently restore a fake session.
    if (!sessionStorage.getItem('sims-browser-test-initialized')) {
      if (signedIn) sessionStorage.setItem('sims-access-token', 'browser-test-token')
      localStorage.setItem('sims-theme', theme)
      sessionStorage.setItem('sims-browser-test-initialized', '1')
    }
  }, { signedIn, theme })

  const user = (value) => state.users.find((item) => item._id === value) || null
  const account = (value) => value && { id: value._id, name: value.name, email: value.email, role: value.role, isActive: value.isActive, profileImage: value.profileImage || '' }
  const current = () => user(state.signedInUserId)
  const company = (value) => state.companies.find((item) => item._id === value) || null
  const opportunity = (value) => {
    const record = state.opportunities.find((item) => item._id === value)
    return record ? { ...record, company: company(record.company) } : null
  }
  const internship = (value) => state.internships.find((item) => item._id === value) || null
  const placement = (record) => ({ ...record, student: user(record.student), supervisor: user(record.supervisor), company: company(record.company), opportunity: opportunity(record.opportunity) })
  const report = (record) => ({ ...record, student: user(record.student), internship: internship(record.internship) })
  const profile = (record) => ({ ...record, user: user(record.user), department: state.departments.find((item) => item._id === record.department) || null })

  await context.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    const method = request.method()
    const values = request.postDataJSON() || {}
    state.calls.push({ method, path, values })
    const reply = (data, status = 200) => route.fulfill({ status, json: { success: status < 400, ...(status < 400 ? { data } : { message: data }) } })
    const fault = state.failures.findIndex((item) => item.path === path && (!item.method || item.method === method))
    if (fault !== -1) {
      const failure = state.failures[fault]
      if (!failure.persistent) state.failures.splice(fault, 1)
      return reply(failure.message || 'Browser test failure', failure.status)
    }
    if (method !== 'GET' && state.holdWrites) await state.holdWrites
    const page = Number(url.searchParams.get('page') || 1)
    const limit = Number(url.searchParams.get('limit') || 10)
    const list = (key, records) => reply({ [key]: records.slice((page - 1) * limit, page * limit), page, limit })
    const nextId = () => id(state.nextId++)

    if (path === '/auth/me' && method === 'GET') return reply({ user: account(current()) })
    if (path === '/auth/me' && method === 'PATCH') {
      const found = current()
      Object.assign(found, { name: values.name, email: values.email, profileImage: values.profileImage })
      return reply({ user: account(found) })
    }
    if (path === '/auth/signup' && method === 'POST') {
      const created = { _id: nextId(), name: values.name, email: values.email, role: 'student', isActive: true, createdAt: stamp() }
      state.users = state.users.filter((item) => item.role !== 'student').concat(created)
      return reply({ user: account(created) }, 201)
    }
    if (path === '/auth/signin' && method === 'POST') {
      const found = state.users.find((item) => item.email === values.email)
      if (!found) return reply('Invalid credentials.', 401)
      state.role = found.role
      state.signedInUserId = found._id
      return reply({ user: account(found), token: 'browser-test-token' })
    }
    if (path === '/dashboard/stats' && method === 'GET') {
      if (state.holdDashboard) await state.holdDashboard
      return reply({ role: state.role, stats: state.dashboardStats || Object.fromEntries(dashboardFields[state.role].map((field) => [field, 2])) })
    }
    if (path === '/users' && method === 'GET') return list('users', state.users)
    if (path === '/auth/create-user' && method === 'POST') {
      if (state.users.some((item) => item.email === values.email)) return reply('An account with this email already exists.', 409)
      const created = { _id: nextId(), name: values.name, email: values.email, role: values.role, isActive: true, createdAt: stamp() }
      state.users.unshift(created)
      return reply({ user: account(created) }, 201)
    }
    if (/^\/users\/[^/]+\/status$/.test(path) && method === 'PATCH') {
      const found = user(path.split('/')[2])
      Object.assign(found, values)
      return reply({ user: account(found) })
    }
    if (/^\/users\/[^/]+$/.test(path) && ['PATCH', 'DELETE'].includes(method)) {
      if (state.role !== 'admin') return reply('Only administrators can access this resource.', 403)
      const found = user(path.split('/')[2])
      if (!found) return reply('User not found.', 404)
      if (found.role === 'admin') return reply('Administrator accounts are protected.', 403)
      if (method === 'PATCH') {
        if (state.users.some((item) => item._id !== found._id && item.email === values.email)) return reply('An account with this email already exists.', 409)
        Object.assign(found, { name: values.name, email: values.email })
        return reply({ user: account(found) })
      }
      if (found.isActive) return reply('Deactivate this account before deleting it.', 409)
      const references = [[state.profiles, ['user']], [state.applications, ['student', 'reviewedBy']],
        [state.internships, ['student', 'supervisor', 'createdBy']], [state.companies, ['representative', 'createdBy']],
        [state.opportunities, ['createdBy']], [state.dailyReports, ['student', 'reviewedBy']],
        [state.weeklyReports, ['student']], [state.evaluations, ['student', 'evaluator']]]
      if (references.some(([records, fields]) => records.some((record) => fields.some((field) => record[field] === found._id)))) {
        return reply('This user has project records and cannot be deleted. Keep the account inactive to preserve its history.', 409)
      }
      state.users = state.users.filter((item) => item._id !== found._id)
      return reply({ userId: found._id })
    }
    if (path === '/departments' && method === 'GET') return list('departments', state.departments)
    if (path === '/departments' && method === 'POST') {
      const created = { _id: nextId(), ...values }
      state.departments.unshift(created)
      return reply({ department: created }, 201)
    }
    if (path === '/students/me' && method === 'GET') {
      const found = state.profiles.find((item) => item.user === current()._id)
      return found ? reply({ profile: profile(found) }) : reply('Profile not found.', 404)
    }
    if (path === '/students/me' && method === 'PUT') {
      let found = state.profiles.find((item) => item.user === current()._id)
      if (!found) { found = { _id: nextId(), user: current()._id }; state.profiles.push(found) }
      Object.assign(found, values, { department: values.departmentId })
      return reply({ profile: found })
    }
    if (path === '/students' && method === 'GET') return list('profiles', state.profiles.map(profile))
    if (path === '/companies' && method === 'GET') return list('companies', state.companies)
    if (path === '/companies' && method === 'POST') {
      const created = { _id: nextId(), ...values, representative: null, createdBy: current()._id, createdAt: stamp() }
      state.companies.unshift(created)
      return reply({ company: created }, 201)
    }
    if (/^\/companies\/[^/]+\/representative$/.test(path) && method === 'PATCH') {
      const found = company(path.split('/')[2])
      found.representative = values.representativeId
      return reply({ company: found })
    }
    if (path === '/opportunities' && method === 'GET') return list('opportunities', state.opportunities.map((item) => opportunity(item._id)))
    if (path === '/opportunities' && method === 'POST') {
      const owner = company(values.companyId)
      if (!owner || owner.representative !== current()._id) return reply('You do not represent this company.', 403)
      const { companyId, ...fields } = values
      const created = { _id: nextId(), ...fields, company: companyId, createdBy: current()._id, status: 'open', createdAt: stamp() }
      state.opportunities.unshift(created)
      return reply({ opportunity: created }, 201)
    }
    if ((path === '/applications' || path === '/applications/me') && method === 'GET') {
      const status = url.searchParams.get('status')
      const records = state.applications.filter((item) => (!status || status === item.status) && (state.role === 'admin' || item.student === current()._id))
      return list('applications', records.map((item) => ({ ...item, student: state.role === 'admin' ? user(item.student) : item.student, opportunity: opportunity(item.opportunity) })))
    }
    if (path === '/applications' && method === 'POST') {
      if (state.applications.some((item) => item.opportunity === values.opportunityId && item.student === current()._id)) return reply('You already applied for this opportunity.', 409)
      const created = { _id: nextId(), opportunity: values.opportunityId, student: current()._id, status: 'pending', rejectionReason: '', createdAt: stamp() }
      state.applications.unshift(created)
      return reply({ application: created }, 201)
    }
    if (/^\/applications\/[^/]+\/decision$/.test(path) && method === 'PATCH') {
      const found = state.applications.find((item) => item._id === path.split('/')[2])
      Object.assign(found, { ...values, rejectionReason: values.rejectionReason || '', reviewedBy: current()._id, reviewedAt: stamp() })
      return reply({ application: found })
    }
    if (path === '/internships' && method === 'GET') return list('internships', state.internships.map(placement))
    if (path === '/internships' && method === 'POST') {
      const application = state.applications.find((item) => item._id === values.applicationId)
      const created = { _id: nextId(), application: application._id, student: application.student, opportunity: application.opportunity, company: opportunity(application.opportunity).company._id, supervisor: values.supervisorId, createdBy: current()._id, status: 'assigned', isOngoing: true, startDate: `${values.startDate}T00:00:00.000Z`, endDate: `${values.endDate}T00:00:00.000Z`, statusHistory: [] }
      state.internships.unshift(created)
      return reply({ internship: created }, 201)
    }
    if (/^\/internships\/[^/]+\/status$/.test(path) && method === 'PATCH') {
      const found = internship(path.split('/')[2])
      found.statusHistory.push({ from: found.status, to: values.status, reason: values.reason || '', changedBy: current()._id, changedAt: stamp() })
      Object.assign(found, { status: values.status, isOngoing: ['assigned', 'active'].includes(values.status) })
      return reply({ internship: found })
    }
    for (const [prefix, key] of [['/daily-reports', 'dailyReports'], ['/weekly-reports', 'weeklyReports']]) {
      if (path === prefix && method === 'GET') return list('reports', state[key].map(report))
      if (path === prefix && method === 'POST') {
        const { internshipId, date, ...fields } = values
        const created = { _id: nextId(), ...fields, internship: internshipId, student: current()._id, status: 'draft', submittedAt: null,
          ...(key === 'dailyReports' ? { date: `${date}T00:00:00.000Z`, feedback: '', reviewedBy: null, reviewedAt: null } : getWeeklyReportDates(internship(internshipId), values.weekNumber)) }
        state[key].unshift(created)
        return reply({ report: created }, 201)
      }
      if (path.startsWith(`${prefix}/`)) {
        const [, , recordId, action] = path.split('/')
        const found = state[key].find((item) => item._id === recordId)
        if (found && method === 'PATCH' && !action) { Object.assign(found, values); return reply({ report: found }) }
        if (found && method === 'POST' && action === 'submit') {
          Object.assign(found, { status: 'submitted', submittedAt: new Date().toISOString() })
          return reply({ report: found })
        }
        if (found && method === 'PATCH' && ['request-changes', 'approve'].includes(action)) {
          Object.assign(found, { status: action === 'approve' ? 'approved' : 'changes_requested', reviewedBy: current()._id, reviewedAt: new Date().toISOString(), feedback: values.feedback || found.feedback })
          return reply({ report: found })
        }
      }
    }
    if (path === '/evaluations' && method === 'GET') return list('evaluations', state.evaluations.map((item) => ({ ...item, student: user(item.student), evaluator: user(item.evaluator) })))
    if (path === '/evaluations' && method === 'POST') {
      const created = { _id: nextId(), internship: values.internshipId, student: internship(values.internshipId).student, evaluator: current()._id, type: state.role === 'academic_supervisor' ? 'academic' : 'company', score: values.score, comments: values.comments, createdAt: stamp() }
      state.evaluations.unshift(created)
      return reply({ evaluation: created }, 201)
    }
    // Never forward an unmatched API request to the real application/database.
    state.unexpected.push(`${method} ${path}`)
    return reply('No browser fixture for this request.', 404)
  })
}
