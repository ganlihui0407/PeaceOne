import {
  LayoutDashboard,
  User,
  Sparkles,
  Target,
  ListChecks,
  BookOpen,
  Briefcase,
  FileText,
  Bell,
  CalendarDays,
  Building2,
  Users,
  ClipboardList,
  ShieldAlert,
  BarChart3,
  Library,
  History,
} from 'lucide-react'

export const studentNav = [
  { label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard, end: true },
  { label: 'My Profile', to: '/student/profile', icon: User },
  { label: 'My Skills', to: '/student/skills', icon: Sparkles },
  { label: 'My Resume', to: '/student/resume', icon: FileText },
  { label: 'Career Target', to: '/student/career-target', icon: Target },
  { label: 'Skill Gap Analysis', to: '/student/skill-gap', icon: ListChecks },
  { label: 'Learning', to: '/student/learning', icon: BookOpen },
  { label: 'Jobs', to: '/student/jobs', icon: Briefcase },
  { label: 'Applications', to: '/student/applications', icon: FileText },
  { label: 'Interviews', to: '/student/interviews', icon: CalendarDays },
  { label: 'Notifications', to: '/student/notifications', icon: Bell },
]

export const jobSeekerNav = [
  { label: 'Dashboard', to: '/jobseeker/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Jobs', to: '/jobseeker/jobs', icon: Briefcase },
  { label: 'Applications', to: '/jobseeker/applications', icon: FileText },
  { label: 'Interviews', to: '/jobseeker/interviews', icon: CalendarDays },
  { label: 'My Profile', to: '/jobseeker/profile', icon: User },
  { label: 'My Skills', to: '/jobseeker/skills', icon: Sparkles },
  { label: 'My Resume', to: '/jobseeker/resume', icon: FileText },
  { label: 'Learning', to: '/jobseeker/learning', icon: BookOpen },
  { label: 'Notifications', to: '/jobseeker/notifications', icon: Bell },
]

export const employerNav = [
  { label: 'Dashboard', to: '/employer/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Jobs', to: '/employer/jobs', icon: Briefcase },
  { label: 'Applicants', to: '/employer/applicants', icon: Users },
  { label: 'Interviews', to: '/employer/interviews', icon: CalendarDays },
  { label: 'Company', to: '/employer/company', icon: Building2 },
  { label: 'My Profile', to: '/employer/profile', icon: User },
  { label: 'Notifications', to: '/employer/notifications', icon: Bell },
]

export const adminNav = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Position Requests', to: '/admin/position-requests', icon: ClipboardList, end: true },
  { label: 'MASCO Occupations', to: '/admin/masco', icon: Library, end: true },
  { label: 'MASCO Crosswalks', to: '/admin/masco/crosswalks', icon: History },
  { label: 'Job Monitoring', to: '/admin/jobs', icon: Briefcase },
  { label: 'Learning Content', to: '/admin/learning', icon: BookOpen },
  { label: 'Content Monitoring', to: '/admin/content', icon: ShieldAlert },
  { label: 'Reports & Analysis', to: '/admin/reports', icon: BarChart3 },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
  { label: 'My Profile', to: '/admin/profile', icon: User },
]
