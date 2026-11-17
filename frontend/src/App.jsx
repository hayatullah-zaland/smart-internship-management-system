import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Departments from './pages/Departments'
import Login from './pages/Login'
import Opportunities from './pages/Opportunities'
import MyApplications from './pages/MyApplications'
import Signup from './pages/Signup'
import StudentProfile from './pages/StudentProfile'
import AdminApplications from './pages/AdminApplications'
import Internships from './pages/Internships'
import { INTERNSHIP_ROLES } from './context/internshipApi'
import DailyReports from './pages/DailyReports'
import { DAILY_REPORT_ROLES } from './context/dailyReportApi'
import WeeklyReports from './pages/WeeklyReports'
import { WEEKLY_REPORT_ROLES } from './context/weeklyReportApi'
import Evaluations from './pages/Evaluations'
import { EVALUATION_ROLES } from './context/evaluationApi'

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
      <Route path="/opportunities" element={
        <ProtectedRoute>
          <Opportunities />
        </ProtectedRoute>
      } />
      <Route path="/applications" element={
        <ProtectedRoute requiredRole="student">
          <MyApplications />
        </ProtectedRoute>
      } />
      <Route path="/admin/applications" element={
        <ProtectedRoute requiredRole="admin">
          <AdminApplications />
        </ProtectedRoute>
      } />
      <Route path="/internships" element={
        <ProtectedRoute allowedRoles={INTERNSHIP_ROLES}>
          <Internships />
        </ProtectedRoute>
      } />
      <Route path="/daily-reports" element={
        <ProtectedRoute allowedRoles={DAILY_REPORT_ROLES}>
          <DailyReports />
        </ProtectedRoute>
      } />
      <Route path="/weekly-reports" element={
        <ProtectedRoute allowedRoles={WEEKLY_REPORT_ROLES}>
          <WeeklyReports />
        </ProtectedRoute>
      } />
      <Route path="/evaluations" element={
        <ProtectedRoute allowedRoles={EVALUATION_ROLES}>
          <Evaluations />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
