export const MAX_PROFILE_IMAGE_BYTES = 64 * 1024
export const MAX_PHOTO_FILE_BYTES = 5 * 1024 * 1024
const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

export function isProfileImage(value) {
  return typeof value === 'string' && (value === '' || (value.length <= 23 + 4 * Math.ceil(MAX_PROFILE_IMAGE_BYTES / 3)
    && /^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    && value.length > 23))
}

export async function prepareProfileImage(file) {
  if (!file || !imageTypes.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  if (!file.size || file.size > MAX_PHOTO_FILE_BYTES) throw new Error('Choose an image smaller than 5 MB.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const image = canvas.toDataURL('image/jpeg', 0.85)
    if (!isProfileImage(image)) throw new Error('Image is too large.')
    return image
  } catch {
    throw new Error('Unable to read this photo. Choose another JPG, PNG or WebP image.')
  } finally {
    bitmap?.close()
  }
}
