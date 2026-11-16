import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Departments from './pages/Departments'
import Login from './pages/Login'
import Signup from './pages/Signup'
import StudentProfile from './pages/StudentProfile'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute requiredRole="student">
          <StudentProfile />
        </ProtectedRoute>
      } />
      <Route path="/departments" element={
        <ProtectedRoute requiredRole="admin">
          <Departments />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
