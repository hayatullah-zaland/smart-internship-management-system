import { useContext } from 'react'
import { Navigate } from 'react-router'
import { AuthContext } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole, allowedRoles }) {
  const { user, token } = useContext(AuthContext)

  if (!user || !token) {
    return <Navigate to="/login" replace />
  }

  if ((requiredRole && user.role !== requiredRole) || (allowedRoles && !allowedRoles.includes(user.role))) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
