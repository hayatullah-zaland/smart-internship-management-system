import { apiRequest } from './apiRequest.js'

function isDepartment(department) {
  return typeof department?._id === 'string' && /^[a-f0-9]{24}$/i.test(department._id)
    && typeof department.name === 'string' && Boolean(department.name.trim())
    && typeof department.code === 'string' && Boolean(department.code.trim())
}

export function validateDepartment(values) {
  const errors = {}
  if (typeof values.name !== 'string' || values.name.trim().length < 2 || values.name.trim().length > 100) {
    errors.name = 'Enter a department name between 2 and 100 characters.'
  }
  if (typeof values.code !== 'string' || !/^[a-z0-9-]{1,20}$/i.test(values.code.trim())) {
    errors.code = 'Use 1-20 letters, numbers or hyphens.'
  }
  return errors
}

export async function fetchDepartments(token, signal) {
  const departments = []
  // Read every page so both screens include all departments, not just the first 20.
  for (let page = 1; ; page += 1) {
    const result = await apiRequest(`/api/v1/departments?page=${page}&limit=100`, token, { signal })
    const batch = result.data?.departments
    if (!Array.isArray(batch) || result.data.page !== page || result.data.limit !== 100 || batch.length > 100
      || batch.some((department) => !isDepartment(department))) {
      throw new Error('The server returned invalid department data. Please try again.')
    }
    departments.push(...batch)
    if (batch.length < 100) return departments
  }
}

export async function createDepartment(token, values, signal) {
  const errors = validateDepartment(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const result = await apiRequest('/api/v1/departments', token, {
    method: 'POST', values: { name: values.name.trim(), code: values.code.trim().toUpperCase() }, signal,
  })
  if (!isDepartment(result.data?.department)) {
    throw new Error('The server returned invalid department data. Please check the list before trying again.')
  }
  return result.data.department
}
