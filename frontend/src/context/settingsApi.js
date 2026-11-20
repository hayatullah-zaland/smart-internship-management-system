import { apiRequest } from './apiRequest.js'

export function validatePasswordChange(values) {
  const errors = {}
  const bytes = (value) => new TextEncoder().encode(value).length
  if (typeof values?.currentPassword !== 'string' || !values.currentPassword || bytes(values.currentPassword) > 72) {
    errors.currentPassword = 'Enter your current password (no more than 72 UTF-8 bytes).'
  }
  if (typeof values?.newPassword !== 'string' || values.newPassword.length < 8 || bytes(values.newPassword) > 72) {
    errors.newPassword = 'Use at least 8 characters and no more than 72 UTF-8 bytes.'
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = 'New password must be different from your current password.'
  }
  if (typeof values?.confirmPassword !== 'string' || !values.confirmPassword || values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'The new passwords must match.'
  }
  return errors
}

export async function changePassword(token, values, signal) {
  const errors = validatePasswordChange(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  try {
    const result = await apiRequest('/api/v1/auth/change-password', token, {
      method: 'PATCH', values: { currentPassword: values.currentPassword, newPassword: values.newPassword }, signal,
    })
    if (result.message !== 'Password changed successfully.') throw new Error('Unconfirmed password change')
  } catch (error) {
    if ([400, 401, 403, 429].includes(error.status)) throw error
    const uncertain = new Error('Password change could not be confirmed. Check whether your new password works before trying again.')
    uncertain.uncertain = true
    throw uncertain
  }
}
