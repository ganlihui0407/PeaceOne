import { useState } from 'react'
import AppLayout from '../components/layout/AppLayout.jsx'
import PageContent from '../components/layout/PageContent.jsx'
import PublicHeader from '../components/layout/PublicHeader.jsx'
import BrandMark from '../components/common/BrandMark.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import Avatar from '../components/common/Avatar.jsx'
import Table from '../components/common/Table.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import MediaImage from '../components/common/MediaImage.jsx'
import Card from '../components/cards/Card.jsx'
import ContentCard from '../components/cards/ContentCard.jsx'
import StatCard from '../components/cards/StatCard.jsx'
import JobCard from '../components/cards/JobCard.jsx'
import CourseCard from '../components/cards/CourseCard.jsx'
import TextInput from '../components/forms/TextInput.jsx'
import SearchInput from '../components/forms/SearchInput.jsx'
import PasswordInput from '../components/forms/PasswordInput.jsx'
import SelectInput from '../components/forms/SelectInput.jsx'
import TextArea from '../components/forms/TextArea.jsx'
import DateInput from '../components/forms/DateInput.jsx'
import TimeInput from '../components/forms/TimeInput.jsx'
import Checkbox from '../components/forms/Checkbox.jsx'
import RadioGroup from '../components/forms/RadioGroup.jsx'
import FormField from '../components/forms/FormField.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'
import DetailItem from '../components/ui/DetailItem.jsx'
import { badgeExamples, colourRoles, radiusTokens, typeScale } from '../data/designTokens.js'
import { jobs } from '../data/jobs.js'
import { courses } from '../data/courses.js'

function PreviewSection({ title, description, children }) {
  return (
    <section className="mb-10">
      <h2 className="po-section-title">{title}</h2>
      {description ? <p className="po-secondary mt-1 mb-4">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

function DesignSystem() {
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [pathway, setPathway] = useState('career')
  const [agreed, setAgreed] = useState(false)
  const [search, setSearch] = useState('')

  return (
    <AppLayout
      title="Design system"
      userName="PeaceOne"
      userRole="Development preview"
      navItems={[]}
      showSearch={false}
    >
      <PageContent
        title="PeaceOne design system"
        breadcrumb="Development preview"
        description="Current reusable components, colour roles and type styles used by the PeaceOne prototype. This route is not part of public or role navigation."
      >
        <PreviewSection title="Branding" description="Simple text wordmark for education and career use.">
          <div className="flex flex-wrap items-center gap-8">
            <BrandMark as="span" />
            <p className="po-secondary">AI-Powered Career Development Platform</p>
          </div>
        </PreviewSection>

        <PreviewSection title="Public navbar">
          <div className="overflow-hidden rounded-xl border border-line">
            <PublicHeader sticky={false} />
          </div>
        </PreviewSection>

        <PreviewSection
          title="Colour roles"
          description="Approved PeaceOne blue-and-white identity. Information uses the primary blue rather than a separate hue."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {colourRoles.map((swatch) => (
              <div key={swatch.name} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className={`h-16 ${swatch.className}`} />
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-ink">{swatch.name}</p>
                  <p className="po-helper mt-0">{swatch.role}</p>
                  <p className="po-secondary">{swatch.value}</p>
                </div>
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection title="Typography" description="Shared heading and body classes used across modules.">
          <div className="space-y-5 rounded-xl border border-line bg-surface p-6">
            {typeScale.map((item) => (
              <div key={item.name}>
                <p className="po-helper mb-1">{item.name}</p>
                <p className={item.className}>{item.sample}</p>
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection title="Radius" description="Small set used for buttons, inputs, cards and modals.">
          <div className="grid gap-3 sm:grid-cols-3">
            {radiusTokens.map((item) => (
              <div key={item.name} className="border border-line bg-surface p-4" style={{ borderRadius: item.value }}>
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="po-secondary">{item.value} · {item.use}</p>
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection
          title="Buttons"
          description="Primary for main actions, secondary for alternatives, outline for lower-priority actions, danger for destructive mock actions."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Create Account</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="outline">Add Skill</Button>
            <Button variant="ghost">View Learning</Button>
            <Button variant="danger">Remove</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </PreviewSection>

        <PreviewSection title="Form controls" description="Shared 44px height, 8px radius, labels, helper text, focus ring and placeholder colour.">
          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              id="full-name"
              label="Full name"
              placeholder="Alex Tan"
              helperText="This is how your name will appear on PeaceOne."
            />
            <TextInput
              id="email-error"
              label="Email"
              defaultValue="alex@"
              error="Enter a valid email address."
            />
            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText="At least 8 characters."
              autoComplete="new-password"
            />
            <SelectInput
              id="role"
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              options={[
                { value: 'student', label: 'Student' },
                { value: 'jobseeker', label: 'Job seeker' },
                { value: 'employer', label: 'Company staff' },
              ]}
            />
            <SearchInput
              id="design-search"
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SQL, Data Analyst"
            />
            <DateInput id="available-from" label="Available from" />
            <TimeInput id="interview-time" label="Interview time" />
            <FormField id="form-field-demo" label="Form field wrapper" helperText="Shared label, helper and 44px control height.">
              {(describedBy) => (
                <input id="form-field-demo" className="po-field" placeholder="Uses FormField" aria-describedby={describedBy} />
              )}
            </FormField>
            <TextInput id="disabled-field" label="Disabled field" defaultValue="Read only value" disabled />
            <div className="md:col-span-2">
              <TextArea
                id="summary"
                label="Profile summary"
                placeholder="Write a short professional summary."
                helperText="Keep this concise for employers and mentors."
              />
            </div>
            <Checkbox
              id="guidelines"
              label="I agree to the PeaceOne usage guidelines"
              helperText="Visual checkbox only. No data is saved."
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <RadioGroup
              name="pathway"
              legend="Preferred pathway"
              value={pathway}
              onChange={setPathway}
              options={[
                { value: 'career', label: 'Career development' },
                { value: 'learning', label: 'Learning first' },
                { value: 'recruitment', label: 'Recruitment' },
              ]}
            />
          </div>
        </PreviewSection>

        <PreviewSection title="Cards" description="Statistic, content and specialised cards share the same surface, border and radius.">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Open applications" value="12" />
            <ContentCard title="UX fundamentals" description="A compact information card for later learning pages." />
            <Card hoverable>
              <h3 className="po-card-title">Frontend intern</h3>
              <p className="po-secondary mt-2">Hoverable card with a subtle lift for job-style lists.</p>
            </Card>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <JobCard job={jobs[0]} to="/jobs/junior-software-developer" />
            <CourseCard course={courses[0]} to="/learning" />
          </div>
        </PreviewSection>

        <PreviewSection title="Section header and detail items">
          <Card>
            <SectionHeader
              title="Upcoming interviews"
              description="Shared section title with an optional action."
              action={
                <Button size="sm" variant="ghost">
                  View details
                </Button>
              }
            />
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Company" value="Nexa Digital" />
              <DetailItem label="Date" value="18 Apr 2026" />
              <DetailItem label="Time" value="10:00 AM" />
              <DetailItem label="Status">
                <Badge status="scheduled">Scheduled</Badge>
              </DetailItem>
            </dl>
          </Card>
        </PreviewSection>

        <PreviewSection title="Status badges" description="Green for completed states, blue for informational, amber for pending, red for rejected or missing.">
          <div className="flex flex-wrap gap-2">
            {badgeExamples.map((item) => (
              <Badge key={item.label} status={item.status} className="normal-case">
                {item.label}
              </Badge>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection title="Empty states">
          <div className="grid gap-4 md:grid-cols-2">
            <Card padding="sm">
              <EmptyState title="No records to display." description="Filters can be cleared to see the full list again." />
            </Card>
            <Card padding="sm">
              <EmptyState
                title="No notifications yet"
                description="Updates about applications and learning will appear here."
                action={
                  <Button size="sm" variant="outline" to="/student/jobs">
                    Explore Jobs
                  </Button>
                }
              />
            </Card>
          </div>
        </PreviewSection>

        <PreviewSection title="Avatars">
          <div className="flex items-center gap-4">
            <Avatar name="Alex Tan" size="sm" />
            <Avatar name="Alex Tan" size="md" />
            <Avatar name="Jordan Lee" size="lg" />
          </div>
        </PreviewSection>

        <PreviewSection title="Tables" description="Headers, row padding and status badges stay inside a horizontally scrolling wrapper.">
          <Table
            headers={['Name', 'Role', 'Status', 'Actions']}
            rows={[
              [
                'Alex Tan',
                'Student',
                <Badge key="active" status="active">Active</Badge>,
                <Button key="view-alex" size="sm" variant="secondary">View Details</Button>,
              ],
              [
                'Jordan Lee',
                'Job seeker',
                <Badge key="pending" status="pending">Pending</Badge>,
                <Button key="view-jordan" size="sm" variant="secondary">View Details</Button>,
              ],
              [
                'Samira Ong',
                'Company staff',
                <Badge key="verified" status="verified">Verified</Badge>,
                <Button key="view-samira" size="sm" variant="secondary">View Details</Button>,
              ],
            ]}
          />
        </PreviewSection>

        <PreviewSection title="Image wrapper" description="Ready for later public imagery. No stock photos added in this stage.">
          <div className="max-w-md">
            <MediaImage alt="Placeholder media frame" />
          </div>
        </PreviewSection>
      </PageContent>
    </AppLayout>
  )
}

export default DesignSystem
