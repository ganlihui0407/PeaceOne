import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/layout/PublicLayout.jsx'
import CandidateLayout from './components/layout/CandidateLayout.jsx'
import EmployerLayout from './components/layout/EmployerLayout.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import Home from './pages/public/Home.jsx'
import Jobs from './pages/public/Jobs.jsx'
import JobDetail from './pages/public/JobDetail.jsx'
import Learning from './pages/public/Learning.jsx'
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
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import AdminUserDetails from './pages/admin/UserDetails.jsx'
import AdminJobMonitoring from './pages/admin/JobMonitoring.jsx'
import AdminJobModeration from './pages/admin/JobModeration.jsx'
import AdminLearningManagement from './pages/admin/LearningManagement.jsx'
import AdminLearningContentForm from './pages/admin/LearningContentForm.jsx'
import AdminContentMonitoring from './pages/admin/ContentMonitoring.jsx'
import AdminReports from './pages/admin/Reports.jsx'
import AdminProfile from './pages/admin/Profile.jsx'
import ProfilePage from './pages/shared/ProfilePage.jsx'
import NotificationsPage from './pages/shared/NotificationsPage.jsx'
import SkillsPage from './pages/shared/SkillsPage.jsx'
import ResumePage from './pages/shared/ResumePage.jsx'
import CareerTargetPage from './pages/shared/CareerTargetPage.jsx'
import SkillGapPage from './pages/shared/SkillGapPage.jsx'
import LearningRecommendationsPage from './pages/shared/LearningRecommendationsPage.jsx'
import LearningDetailPage from './pages/shared/LearningDetailPage.jsx'
import LearningProgressPage from './pages/shared/LearningProgressPage.jsx'
import CandidateJobsPage from './pages/shared/CandidateJobsPage.jsx'
import CandidateJobDetailPage from './pages/shared/CandidateJobDetailPage.jsx'
import ApplyPage from './pages/shared/ApplyPage.jsx'
import ApplicationsPage from './pages/shared/ApplicationsPage.jsx'
import InterviewsPage from './pages/shared/InterviewsPage.jsx'
import ModulePlaceholder from './pages/shared/ModulePlaceholder.jsx'
import DesignSystem from './pages/DesignSystem.jsx'
import { jobSeekerProfile, studentProfile } from './data/candidateData.js'
import { adminNotifications, employerNotifications, jobSeekerNotifications, studentNotifications } from './data/notifications.js'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route path="/student" element={<CandidateLayout role="student" />}>
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="profile" element={<ProfilePage profile={studentProfile} />} />
          <Route path="notifications" element={<NotificationsPage items={studentNotifications} />} />
          <Route path="skills" element={<SkillsPage basePath="/student" />} />
          <Route path="resume" element={<ResumePage role="student" />} />
          <Route path="career-target" element={<CareerTargetPage basePath="/student" />} />
          <Route path="skill-gap" element={<SkillGapPage basePath="/student" />} />
          <Route path="learning" element={<LearningRecommendationsPage basePath="/student" />} />
          <Route path="learning/progress" element={<LearningProgressPage basePath="/student" />} />
          <Route path="learning/:contentId" element={<LearningDetailPage basePath="/student" />} />
          <Route path="jobs" element={<CandidateJobsPage basePath="/student" variant="student" />} />
          <Route path="jobs/:jobId" element={<CandidateJobDetailPage basePath="/student" variant="student" />} />
          <Route path="jobs/:jobId/apply" element={<ApplyPage basePath="/student" variant="student" />} />
          <Route path="applications" element={<ApplicationsPage variant="student" />} />
          <Route path="settings" element={<ModulePlaceholder title="Settings" />} />
        </Route>

        <Route path="/jobseeker" element={<CandidateLayout role="jobseeker" />}>
          <Route path="dashboard" element={<JobSeekerDashboard />} />
          <Route path="profile" element={<ProfilePage profile={jobSeekerProfile} />} />
          <Route path="notifications" element={<NotificationsPage items={jobSeekerNotifications} />} />
          <Route path="skills" element={<SkillsPage basePath="/jobseeker" />} />
          <Route path="resume" element={<ResumePage role="jobseeker" />} />
          <Route path="career-target" element={<CareerTargetPage basePath="/jobseeker" />} />
          <Route path="skill-gap" element={<SkillGapPage basePath="/jobseeker" />} />
          <Route path="jobs" element={<CandidateJobsPage basePath="/jobseeker" variant="jobseeker" />} />
          <Route path="jobs/:jobId" element={<CandidateJobDetailPage basePath="/jobseeker" variant="jobseeker" />} />
          <Route path="jobs/:jobId/apply" element={<ApplyPage basePath="/jobseeker" variant="jobseeker" />} />
          <Route path="applications" element={<ApplicationsPage variant="jobseeker" />} />
          <Route path="interviews" element={<InterviewsPage />} />
          <Route path="learning" element={<LearningRecommendationsPage basePath="/jobseeker" />} />
          <Route path="learning/progress" element={<LearningProgressPage basePath="/jobseeker" />} />
          <Route path="learning/:contentId" element={<LearningDetailPage basePath="/jobseeker" />} />
          <Route path="settings" element={<ModulePlaceholder title="Settings" />} />
        </Route>

        <Route path="/employer" element={<EmployerLayout />}>
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
          <Route path="notifications" element={<NotificationsPage items={employerNotifications} />} />
          <Route path="settings" element={<ModulePlaceholder title="Settings" />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetails />} />
          <Route path="jobs" element={<AdminJobMonitoring />} />
          <Route path="jobs/:jobId" element={<AdminJobModeration />} />
          <Route path="learning" element={<AdminLearningManagement />} />
          <Route path="learning/create" element={<AdminLearningContentForm />} />
          <Route path="learning/:contentId/edit" element={<AdminLearningContentForm />} />
          <Route path="content" element={<AdminContentMonitoring />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="notifications" element={<NotificationsPage items={adminNotifications} />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="settings" element={<ModulePlaceholder title="Settings" />} />
        </Route>

        <Route path="/design-system" element={<DesignSystem />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
