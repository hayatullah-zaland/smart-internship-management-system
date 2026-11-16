import { apiRequest } from './apiRequest.js'

const objectId = /^[a-f0-9]{24}$/i

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
