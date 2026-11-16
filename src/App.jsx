import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/layout/PublicLayout.jsx'
import CandidateLayout from './components/layout/CandidateLayout.jsx'
import EmployerLayout from './components/layout/EmployerLayout.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RequireAuth } from './auth/RequireAuth.jsx'

const Home = lazy(() => import('./pages/public/Home.jsx'))
const Jobs = lazy(() => import('./pages/public/Jobs.jsx'))
const JobDetail = lazy(() => import('./pages/public/JobDetail.jsx'))
const Learning = lazy(() => import('./pages/public/Learning.jsx'))
const CourseDetail = lazy(() => import('./pages/public/CourseDetail.jsx'))
const About = lazy(() => import('./pages/public/About.jsx'))
const Login = lazy(() => import('./pages/public/Login.jsx'))
const Register = lazy(() => import('./pages/public/Register.jsx'))
const StudentDashboard = lazy(() => import('./pages/student/Dashboard.jsx'))
const JobSeekerDashboard = lazy(() => import('./pages/jobseeker/Dashboard.jsx'))
const EmployerDashboard = lazy(() => import('./pages/employer/Dashboard.jsx'))
const CompanyProfile = lazy(() => import('./pages/employer/CompanyProfile.jsx'))
const StaffProfile = lazy(() => import('./pages/employer/StaffProfile.jsx'))
const ManageJobs = lazy(() => import('./pages/employer/ManageJobs.jsx'))
const JobPostingFormPage = lazy(() => import('./pages/employer/JobPostingFormPage.jsx'))
const JobPostingDetails = lazy(() => import('./pages/employer/JobPostingDetails.jsx'))
const Applicants = lazy(() => import('./pages/employer/Applicants.jsx'))
const ApplicantDetails = lazy(() => import('./pages/employer/ApplicantDetails.jsx'))
const EmployerInterviews = lazy(() => import('./pages/employer/Interviews.jsx'))
const InterviewFormPage = lazy(() => import('./pages/employer/InterviewFormPage.jsx'))
const EmployerInterviewDetails = lazy(() => import('./pages/employer/InterviewDetails.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'))
const AdminUserDetails = lazy(() => import('./pages/admin/UserDetails.jsx'))
const AdminCompanies = lazy(() => import('./pages/admin/Companies.jsx'))
const AdminCompanyDetails = lazy(() => import('./pages/admin/CompanyDetails.jsx'))
const AdminJobMonitoring = lazy(() => import('./pages/admin/JobMonitoring.jsx'))
const AdminJobModeration = lazy(() => import('./pages/admin/JobModeration.jsx'))
const AdminLearningManagement = lazy(() => import('./pages/admin/LearningManagement.jsx'))
const AdminLearningContentForm = lazy(() => import('./pages/admin/LearningContentForm.jsx'))
const AdminContentMonitoring = lazy(() => import('./pages/admin/ContentMonitoring.jsx'))
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'))
const AdminMascoOccupations = lazy(() => import('./pages/admin/MascoOccupations.jsx'))
const AdminMascoOccupationDetails = lazy(() => import('./pages/admin/MascoOccupationDetails.jsx'))
const AdminMascoCrosswalks = lazy(() => import('./pages/admin/MascoCrosswalks.jsx'))
const AdminProfile = lazy(() => import('./pages/admin/Profile.jsx'))
const AdminPositionChangeRequests = lazy(() => import('./pages/admin/PositionChangeRequests.jsx'))
const AdminPositionChangeRequestDetails = lazy(() => import('./pages/admin/PositionChangeRequestDetails.jsx'))
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage.jsx'))
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage.jsx'))
const SkillsPage = lazy(() => import('./pages/shared/SkillsPage.jsx'))
const ResumePage = lazy(() => import('./pages/shared/ResumePage.jsx'))
const ResumeEditorPage = lazy(() => import('./pages/shared/ResumeEditorPage.jsx'))
const CareerTargetPage = lazy(() => import('./pages/shared/CareerTargetPage.jsx'))
const SkillGapPage = lazy(() => import('./pages/shared/SkillGapPage.jsx'))
const LearningRecommendationsPage = lazy(() => import('./pages/shared/LearningRecommendationsPage.jsx'))
const LearningDetailPage = lazy(() => import('./pages/shared/LearningDetailPage.jsx'))
const LearningLessonPage = lazy(() => import('./pages/shared/LearningLessonPage.jsx'))
const LearningAssessmentPage = lazy(() => import('./pages/shared/LearningAssessmentPage.jsx'))
const LearningProgressPage = lazy(() => import('./pages/shared/LearningProgressPage.jsx'))
const CandidateJobsPage = lazy(() => import('./pages/shared/CandidateJobsPage.jsx'))
const CandidateJobDetailPage = lazy(() => import('./pages/shared/CandidateJobDetailPage.jsx'))
const ApplyPage = lazy(() => import('./pages/shared/ApplyPage.jsx'))
const ApplicationsPage = lazy(() => import('./pages/shared/ApplicationsPage.jsx'))
const ApplicationDetailPage = lazy(() => import('./pages/shared/ApplicationDetailPage.jsx'))
const InterviewsPage = lazy(() => import('./pages/shared/InterviewsPage.jsx'))
const InterviewDetailsPage = lazy(() => import('./pages/shared/InterviewDetailsPage.jsx'))
const SettingsPage = lazy(() => import('./pages/shared/SettingsPage.jsx'))
const DesignSystem = lazy(() => import('./pages/DesignSystem.jsx'))

function PageFallback() {
  return (
    <div className="px-4 py-16 text-center text-sm text-muted" role="status">
      Loading page…
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/learning/:contentId" element={<CourseDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route
          path="/student"
          element={
            <RequireAuth roles={['STUDENT']}>
              <CandidateLayout role="student" />
            </RequireAuth>
          }
        >
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="skills" element={<SkillsPage basePath="/student" />} />
          <Route path="resume" element={<ResumePage basePath="/student" />} />
          <Route path="resume/:resumeId" element={<ResumeEditorPage basePath="/student" />} />
          <Route path="career-target" element={<CareerTargetPage basePath="/student" />} />
          <Route path="skill-gap" element={<SkillGapPage basePath="/student" />} />
          <Route path="learning" element={<LearningRecommendationsPage basePath="/student" />} />
          <Route path="learning/progress" element={<LearningProgressPage basePath="/student" />} />
          <Route path="learning/:contentId/lessons/:lessonId" element={<LearningLessonPage basePath="/student" />} />
          <Route path="learning/:contentId/assessments/:assessmentId" element={<LearningAssessmentPage basePath="/student" />} />
          <Route path="learning/:contentId" element={<LearningDetailPage basePath="/student" />} />
          <Route path="jobs" element={<CandidateJobsPage basePath="/student" variant="student" />} />
          <Route path="jobs/:jobId" element={<CandidateJobDetailPage basePath="/student" variant="student" />} />
          <Route path="jobs/:jobId/apply" element={<ApplyPage basePath="/student" />} />
          <Route path="applications" element={<ApplicationsPage basePath="/student" />} />
          <Route path="applications/:applicationId" element={<ApplicationDetailPage basePath="/student" />} />
          <Route path="interviews" element={<InterviewsPage basePath="/student" />} />
          <Route path="interviews/:interviewId" element={<InterviewDetailsPage basePath="/student" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="/jobseeker"
          element={
            <RequireAuth roles={['JOB_SEEKER']}>
              <CandidateLayout role="jobseeker" />
            </RequireAuth>
          }
        >
          <Route path="dashboard" element={<JobSeekerDashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="skills" element={<SkillsPage basePath="/jobseeker" />} />
          <Route path="resume" element={<ResumePage basePath="/jobseeker" />} />
          <Route path="resume/:resumeId" element={<ResumeEditorPage basePath="/jobseeker" />} />
          <Route path="career-target" element={<CareerTargetPage basePath="/jobseeker" />} />
          <Route path="skill-gap" element={<SkillGapPage basePath="/jobseeker" />} />
          <Route path="jobs" element={<CandidateJobsPage basePath="/jobseeker" variant="jobseeker" />} />
          <Route path="jobs/:jobId" element={<CandidateJobDetailPage basePath="/jobseeker" variant="jobseeker" />} />
          <Route path="jobs/:jobId/apply" element={<ApplyPage basePath="/jobseeker" />} />
          <Route path="applications" element={<ApplicationsPage basePath="/jobseeker" />} />
          <Route path="applications/:applicationId" element={<ApplicationDetailPage basePath="/jobseeker" />} />
          <Route path="interviews" element={<InterviewsPage basePath="/jobseeker" />} />
          <Route path="interviews/:interviewId" element={<InterviewDetailsPage basePath="/jobseeker" />} />
          <Route path="learning" element={<LearningRecommendationsPage basePath="/jobseeker" />} />
          <Route path="learning/progress" element={<LearningProgressPage basePath="/jobseeker" />} />
          <Route path="learning/:contentId/lessons/:lessonId" element={<LearningLessonPage basePath="/jobseeker" />} />
          <Route path="learning/:contentId/assessments/:assessmentId" element={<LearningAssessmentPage basePath="/jobseeker" />} />
          <Route path="learning/:contentId" element={<LearningDetailPage basePath="/jobseeker" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="/employer"
          element={
            <RequireAuth roles={['COMPANY_STAFF']}>
              <EmployerLayout />
            </RequireAuth>
          }
        >
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="company" element={<CompanyProfile />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="jobs" element={<ManageJobs />} />
          <Route path="jobs/create" element={<JobPostingFormPage />} />
          <Route path="jobs/:jobId" element={<JobPostingDetails />} />
          <Route path="jobs/:jobId/edit" element={<JobPostingFormPage />} />
          <Route path="applicants" element={<Applicants />} />
          <Route path="applicants/:applicationId" element={<ApplicantDetails />} />
          <Route path="interviews" element={<EmployerInterviews />} />
          <Route path="interviews/create" element={<InterviewFormPage />} />
          <Route path="interviews/:interviewId/edit" element={<InterviewFormPage />} />
          <Route path="interviews/:interviewId" element={<EmployerInterviewDetails />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth roles={['ADMIN']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetails />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="companies/:companyId" element={<AdminCompanyDetails />} />
          <Route path="position-requests" element={<AdminPositionChangeRequests />} />
          <Route path="position-requests/:requestId" element={<AdminPositionChangeRequestDetails />} />
          <Route path="jobs" element={<AdminJobMonitoring />} />
          <Route path="jobs/:jobId" element={<AdminJobModeration />} />
          <Route path="learning" element={<AdminLearningManagement />} />
          <Route path="learning/create" element={<AdminLearningContentForm />} />
          <Route path="learning/:contentId/edit" element={<AdminLearningContentForm />} />
          <Route path="content" element={<AdminContentMonitoring />} />
          <Route path="masco" element={<AdminMascoOccupations />} />
          <Route path="masco/crosswalks" element={<AdminMascoCrosswalks />} />
          <Route path="masco/:code" element={<AdminMascoOccupationDetails />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="/design-system" element={<DesignSystem />} />
      </Routes>
      </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
