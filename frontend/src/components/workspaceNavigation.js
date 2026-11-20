import { Award, BookOpen, BriefcaseBusiness, Building2, ClipboardList, FileText, GraduationCap, LayoutDashboard, NotebookTabs, Settings, UserRound, UsersRound } from 'lucide-react'
import { INTERNSHIP_ROLES } from '../context/internshipApi.js'
import { DAILY_REPORT_ROLES } from '../context/dailyReportApi.js'
import { WEEKLY_REPORT_ROLES } from '../context/weeklyReportApi.js'
import { EVALUATION_ROLES } from '../context/evaluationApi.js'
import { USER_ROLES } from '../context/userApi.js'

const allRoles = Object.keys(USER_ROLES)
const links = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, roles: allRoles, keywords: 'home overview statistics' },
  { to: '/opportunities', label: 'Opportunities', Icon: BriefcaseBusiness, roles: allRoles, keywords: 'browse company internship openings jobs' },
  { to: '/account', label: 'My account', Icon: UserRound, roles: allRoles, keywords: 'personal profile photo avatar name email' },
  { to: '/applications', label: 'My applications', Icon: ClipboardList, roles: ['student'], keywords: 'application apply decisions approval rejection' },
  { to: '/profile', label: 'My profile', Icon: GraduationCap, roles: ['student'], keywords: 'student academic department semester student number' },
  { to: '/admin/students', label: 'Students', Icon: GraduationCap, roles: ['admin'], keywords: 'student directory academic profiles' },
  { to: '/admin/users', label: 'Users', Icon: UsersRound, roles: ['admin'], keywords: 'accounts students teachers administrators company representatives' },
  { to: '/admin/companies', label: 'Companies', Icon: Building2, roles: ['admin'], keywords: 'company directory representatives' },
  { to: '/admin/applications', label: 'Applications', Icon: ClipboardList, roles: ['admin'], keywords: 'application review decisions approval rejection' },
  { to: '/departments', label: 'Departments', Icon: GraduationCap, roles: ['admin'], keywords: 'academic department faculty' },
  { to: '/internships', label: 'Internships', Icon: NotebookTabs, roles: INTERNSHIP_ROLES, keywords: 'placements assignments status history' },
  { to: '/daily-reports', label: 'Daily reports', Icon: FileText, roles: DAILY_REPORT_ROLES, keywords: 'daily journal feedback teacher review' },
  { to: '/weekly-reports', label: 'Weekly reports', Icon: BookOpen, roles: WEEKLY_REPORT_ROLES, keywords: 'weekly summary' },
  { to: '/evaluations', label: 'Evaluations', Icon: Award, roles: EVALUATION_ROLES, keywords: 'scores grades assessment final' },
  { to: '/settings', label: 'Settings', Icon: Settings, roles: allRoles, keywords: 'password security appearance theme light dark', footer: true },
]

export function getWorkspaceLinks(role) {
  return links.filter((link) => link.roles.includes(role))
}

export function searchWorkspacePages(role, query) {
  if (typeof query !== 'string' || !query.trim()) return []
  const normalized = query.trim().toLowerCase().slice(0, 80)
  const terms = normalized.split(/\s+/)
  return getWorkspaceLinks(role).filter((link) => terms.every((term) => `${link.label} ${link.keywords}`.toLowerCase().includes(term)))
    .sort((a, b) => Number(b.label.toLowerCase().startsWith(normalized)) - Number(a.label.toLowerCase().startsWith(normalized)))
    .slice(0, 8)
}
