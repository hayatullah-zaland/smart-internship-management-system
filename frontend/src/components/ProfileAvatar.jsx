import { useState } from 'react'
import { isProfileImage } from '../context/profileImage'

export default function ProfileAvatar({ user, className = 'size-9' }) {
  const [failedImage, setFailedImage] = useState(null)
  const image = user.profileImage
  const initial = Array.from(user.name.trim())[0]?.toUpperCase() || 'U'
  const showImage = image && isProfileImage(image) && image !== failedImage

  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-300 bg-base-200 font-semibold ${className}`} aria-hidden="true">
      {showImage ? <img src={image} alt="" className="h-full w-full object-cover" onError={() => setFailedImage(image)} /> : initial}
    </span>
  )
}
