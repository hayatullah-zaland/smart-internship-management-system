import { apiRequest } from './apiRequest.js'
import { isValidSessionUser } from './authSession.js'
import { isProfileImage } from './profileImage.js'

export function validateAccount(values) {
  const errors = {}
  if (typeof values.name !== 'string' || values.name.trim().length < 2 || values.name.trim().length > 100) {
    errors.name = 'Enter a name between 2 and 100 characters.'
  }
  if (typeof values.email !== 'string' || values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!isProfileImage(values.profileImage)) errors.profileImage = 'Choose a valid profile photo.'
  return errors
}

export async function saveAccount(token, account, values, signal) {
  const errors = validateAccount(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const details = { name: values.name.trim(), email: values.email.trim().toLowerCase(), profileImage: values.profileImage }
  const result = await apiRequest('/api/v1/auth/me', token, { method: 'PATCH', values: details, signal })
  const user = result.data?.user
  if (!isValidSessionUser(user) || user.id !== account.id || user.role !== account.role
    || user.name !== details.name || user.email !== details.email || user.profileImage !== details.profileImage) {
    throw new Error('Unable to confirm your changes. Refresh your account before trying again.')
  }
  return user
}
