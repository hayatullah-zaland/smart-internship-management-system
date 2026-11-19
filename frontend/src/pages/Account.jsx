import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import AccountProfileForm from '../components/AccountProfileForm'
import DashboardLayout from '../components/DashboardLayout'
import ProfileHeader from '../components/ProfileHeader'

export default function Account() {
  const { user } = useContext(AuthContext)
  return (
    <DashboardLayout>
      <ProfileHeader user={user} />
      <AccountProfileForm key={user.id} />
    </DashboardLayout>
  )
}
