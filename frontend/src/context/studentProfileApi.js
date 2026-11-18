import { apiRequest } from './apiRequest.js'

const objectId = /^[a-f0-9]{24}$/i
export const STUDENTS_PAGE_SIZE = 10
export const MAX_STUDENTS_PAGE = 1000000
const isId = (value) => typeof value === 'string' && objectId.test(value)

export function validateStudentProfile(values) {
  const errors = {}
  if (typeof values.studentNumber !== 'string' || !/^[a-z0-9-]{1,30}$/i.test(values.studentNumber.trim())) {
    errors.studentNumber = 'Use 1-30 letters, numbers or hyphens.'
  }
  if (typeof values.departmentId !== 'string' || !objectId.test(values.departmentId)) {
    errors.departmentId = 'Choose a department.'
  }
  const semester = Number(values.semester)
  if (!['string', 'number'].includes(typeof values.semester) || !Number.isInteger(semester) || semester < 1 || semester > 12) {
    errors.semester = 'Enter a whole semester number from 1 to 12.'
  }
  if (typeof values.phone !== 'string' || !/^[+0-9 ()-]{7,25}$/.test(values.phone.trim())
    || values.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Use 7-25 characters with at least 7 digits.'
  }
  return errors
}

function normalizeProfile(values) {
  return {
    studentNumber: values.studentNumber.trim().toUpperCase(),
    departmentId: values.departmentId,
    semester: Number(values.semester),
    phone: values.phone.trim(),
  }
}

function readProfile(profile) {
  // GET populates the department; PUT returns its ID. Both fill the same form.
  const values = {
    studentNumber: profile?.studentNumber,
    departmentId: typeof profile?.department === 'string' ? profile.department : profile?.department?._id,
    semester: profile?.semester,
    phone: profile?.phone,
  }
  if (typeof values.semester !== 'number' || Object.keys(validateStudentProfile(values)).length) {
    throw new Error('The server returned invalid profile data. Please try again.')
  }
  return normalizeProfile(values)
}

export async function fetchStudentProfile(token, signal) {
  let result
  try {
    result = await apiRequest('/api/v1/students/me', token, { signal })
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
  return readProfile(result.data?.profile)
}

export async function saveStudentProfile(token, values, signal) {
  const errors = validateStudentProfile(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const result = await apiRequest('/api/v1/students/me', token, {
    method: 'PUT', values: normalizeProfile(values), signal,
  })
  return readProfile(result.data?.profile)
}

function isDirectoryProfile(profile) {
  if (!isId(profile?._id)) return false
  // Deleted populated references can be null; the academic fields still remain readable.
  const errors = validateStudentProfile({ ...profile, departmentId: profile.department?._id })
  const user = profile.user
  const department = profile.department
  return !errors.studentNumber && !errors.semester && !errors.phone && typeof profile.semester === 'number'
    && (user === null || (isId(user?._id) && typeof user.name === 'string' && user.name.trim().length >= 2 && user.name.length <= 100
      && typeof user.email === 'string' && user.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) && typeof user.isActive === 'boolean'))
    && (department === null || (isId(department?._id) && typeof department.name === 'string' && department.name.trim().length >= 2 && department.name.length <= 100
      && typeof department.code === 'string' && /^[a-z0-9-]{1,20}$/i.test(department.code)))
}

export async function fetchAdminStudentProfiles(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_STUDENTS_PAGE) throw new Error('Choose a valid students page.')
  const result = await apiRequest(`/api/v1/students?page=${page}&limit=${STUDENTS_PAGE_SIZE}`, token, { signal })
  const profiles = result.data?.profiles
  if (!Array.isArray(profiles) || result.data.page !== page || result.data.limit !== STUDENTS_PAGE_SIZE
    || profiles.length > STUDENTS_PAGE_SIZE || profiles.some((profile) => !isDirectoryProfile(profile))
    || new Set(profiles.map((profile) => profile._id.toLowerCase())).size !== profiles.length) {
    throw new Error('The server returned invalid student profiles. Please refresh students.')
  }
  return {
    profiles: profiles.map((profile) => ({ _id: profile._id, studentNumber: profile.studentNumber, semester: profile.semester, phone: profile.phone,
      user: profile.user ? { _id: profile.user._id, name: profile.user.name, email: profile.user.email, isActive: profile.user.isActive } : null,
      department: profile.department ? { _id: profile.department._id, name: profile.department.name, code: profile.department.code } : null })),
    hasNextPage: profiles.length === STUDENTS_PAGE_SIZE && page < MAX_STUDENTS_PAGE,
  }
}
