import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/layout/PublicLayout.jsx'
import CandidateLayout from './components/layout/CandidateLayout.jsx'
import EmployerLayout from './components/layout/EmployerLayout.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import Home from './pages/public/Home.jsx'
import Jobs from './pages/public/Jobs.jsx'
import JobDetail from './pages/public/JobDetail.jsx'
import Learning from './pages/public/Learning.jsx'
import CourseDetail from './pages/public/CourseDetail.jsx'
import About from './pages/public/About.jsx'
import Login from './pages/public/Login.jsx'
import Register from './pages/public/Register.jsx'
import StudentDashboard from './pages/student/Dashboard.jsx'
import JobSeekerDashboard from './pages/jobseeker/Dashboard.jsx'
import EmployerDashboard from './pages/employer/Dashboard.jsx'
import CompanyProfile from './pages/employer/CompanyProfile.jsx'
import StaffProfile from './pages/employer/StaffProfile.jsx'
import ManageJobs from './pages/employer/ManageJobs.jsx'
import JobPostingFormPage from './pages/employer/JobPostingFormPage.jsx'
import JobPostingDetails from './pages/employer/JobPostingDetails.jsx'
import Applicants from './pages/employer/Applicants.jsx'
import ApplicantDetails from './pages/employer/ApplicantDetails.jsx'
import EmployerInterviews from './pages/employer/Interviews.jsx'
import InterviewFormPage from './pages/employer/InterviewFormPage.jsx'
import EmployerInterviewDetails from './pages/employer/InterviewDetails.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import AdminUserDetails from './pages/admin/UserDetails.jsx'
import AdminCompanies from './pages/admin/Companies.jsx'
import AdminCompanyDetails from './pages/admin/CompanyDetails.jsx'
import AdminJobMonitoring from './pages/admin/JobMonitoring.jsx'
import AdminJobModeration from './pages/admin/JobModeration.jsx'
import AdminLearningManagement from './pages/admin/LearningManagement.jsx'
import AdminLearningContentForm from './pages/admin/LearningContentForm.jsx'
import AdminContentMonitoring from './pages/admin/ContentMonitoring.jsx'
import AdminReports from './pages/admin/Reports.jsx'
import AdminMascoOccupations from './pages/admin/MascoOccupations.jsx'
import AdminMascoOccupationDetails from './pages/admin/MascoOccupationDetails.jsx'
import AdminMascoCrosswalks from './pages/admin/MascoCrosswalks.jsx'
import AdminProfile from './pages/admin/Profile.jsx'
import AdminPositionChangeRequests from './pages/admin/PositionChangeRequests.jsx'
import AdminPositionChangeRequestDetails from './pages/admin/PositionChangeRequestDetails.jsx'
import ProfilePage from './pages/shared/ProfilePage.jsx'
import NotificationsPage from './pages/shared/NotificationsPage.jsx'
import SkillsPage from './pages/shared/SkillsPage.jsx'
import ResumePage from './pages/shared/ResumePage.jsx'
import ResumeEditorPage from './pages/shared/ResumeEditorPage.jsx'
import CareerTargetPage from './pages/shared/CareerTargetPage.jsx'
import SkillGapPage from './pages/shared/SkillGapPage.jsx'
import LearningRecommendationsPage from './pages/shared/LearningRecommendationsPage.jsx'
import LearningDetailPage from './pages/shared/LearningDetailPage.jsx'
import LearningLessonPage from './pages/shared/LearningLessonPage.jsx'
import LearningAssessmentPage from './pages/shared/LearningAssessmentPage.jsx'
import LearningProgressPage from './pages/shared/LearningProgressPage.jsx'
import CandidateJobsPage from './pages/shared/CandidateJobsPage.jsx'
import CandidateJobDetailPage from './pages/shared/CandidateJobDetailPage.jsx'
import ApplyPage from './pages/shared/ApplyPage.jsx'
import ApplicationsPage from './pages/shared/ApplicationsPage.jsx'
import ApplicationDetailPage from './pages/shared/ApplicationDetailPage.jsx'
import InterviewsPage from './pages/shared/InterviewsPage.jsx'
import InterviewDetailsPage from './pages/shared/InterviewDetailsPage.jsx'
import SettingsPage from './pages/shared/SettingsPage.jsx'
import DesignSystem from './pages/DesignSystem.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RequireAuth } from './auth/RequireAuth.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
