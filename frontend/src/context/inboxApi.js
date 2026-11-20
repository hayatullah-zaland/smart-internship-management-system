import { apiRequest } from './apiRequest.js'

const links = {
  student: ['/daily-reports', '/weekly-reports', '/applications', '/internships', '/evaluations'],
  admin: ['/daily-reports', '/weekly-reports', '/admin/applications'],
  academic_supervisor: ['/daily-reports', '/internships'],
  company_representative: ['/evaluations'],
}
const isTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

export async function fetchInbox(token, user, signal) {
  if (!Object.hasOwn(links, user?.role) || !/^[a-f0-9]{24}$/i.test(user?.id || '')) throw new Error('Inbox is not available for this account.')
  const result = await apiRequest('/api/v1/inbox', token, { signal })
  const data = result.data
  if (data?.userId !== user.id || data.role !== user.role || !isTime(data.through)) throw new Error('The inbox returned invalid account data.')
  for (const channel of ['messages', 'notifications']) {
    const items = data[channel]
    if (!Array.isArray(items) || items.length > 30 || new Set(items.map((item) => item?.id)).size !== items.length
      || items.some((item, index) => !/^[a-z-]+:[a-f0-9]{24}:\d{1,16}$/i.test(item?.id || '')
        || !isText(item.title, 200) || !isText(item.body, 1200) || !links[user.role].includes(item.href)
        || (channel === 'messages' && (user.role !== 'student' || item.href !== '/daily-reports'))
        || typeof item.read !== 'boolean' || !isTime(item.occurredAt) || item.occurredAt > data.through
        || (index > 0 && item.occurredAt > items[index - 1].occurredAt))
      || data.unread?.[channel] !== items.filter((item) => !item.read).length) {
      throw new Error('The inbox returned invalid activity data. Please refresh.')
    }
  }
  return data
}

export async function markInboxRead(token, channel, through, signal) {
  if (!['messages', 'notifications'].includes(channel) || !isTime(through)) throw new Error('Choose a valid inbox snapshot.')
  const result = await apiRequest('/api/v1/inbox/read', token, { method: 'PATCH', values: { channel, through }, signal })
  if (result.data?.channel !== channel || !isTime(result.data.readAt) || result.data.readAt < through) {
    throw new Error('The read status could not be confirmed. Refresh the inbox.')
  }
  return result.data.readAt
}
