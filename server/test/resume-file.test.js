import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { generateStoredFilename } from '../src/lib/resumeStorage.js';

const TEST_EMAIL_PREFIX = 'stage74a-file-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const createdEmails = [];

let baseline;
let ictSafety;

async function snapshot() {
  const [
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    userSkills,
    resumes,
    education,
    experience,
    resumeSkills,
    certifications,
    resumeFiles,
  ] = await Promise.all([
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoUnitGroup.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.mascoHistoricalCrosswalk.count(),
    prisma.userSkill.count(),
    prisma.resume.count(),
    prisma.resumeEducation.count(),
    prisma.resumeExperience.count(),
    prisma.resumeSkill.count(),
    prisma.resumeCertification.count(),
    prisma.resumeFile.count(),
  ]);
  return {
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    userSkills,
    resumes,
    education,
    experience,
    resumeSkills,
    certifications,
    resumeFiles,
  };
}

async function createCandidate(label) {
  const email = `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@peaceone.test`;
  createdEmails.push(email);
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword('ValidPass1'),
      fullName: 'Stage Seven Four A Student',
      role: 'STUDENT',
      termsAcceptedAt: new Date(),
    },
  });
}

async function createResumeWithSections(user, extras = {}) {
  const skillId = extras.skillId ?? ictSafety.id;
  return prisma.resume.create({
    data: {
      userId: user.id,
      title: 'Software internship CV',
      summary: 'Looking for a software role.',
      templateKey: 'classic',
      isPrimary: true,
      fullName: user.fullName,
      email: user.email,
      phone: '012-680 0001',
      location: 'Kuala Lumpur',
      education: {
        create: {
          sortOrder: 0,
          institution: 'TAR UMT',
          qualification: 'Bachelor of Computer Science',
          fieldOfStudy: 'Software Engineering',
          startYear: 2022,
          endYear: 2026,
          notes: 'Coursework in web systems.',
        },
      },
      experience: {
        create: {
          sortOrder: 0,
          jobTitle: 'Intern',
          organization: 'PeaceOne Labs',
          location: 'Remote',
          startDate: new Date('2025-06-01'),
          isCurrent: true,
          description: 'Built candidate pages.',
        },
      },
      skills: {
        create: {
          sortOrder: 0,
          skillId,
          label: ictSafety.preferredLabel,
          proficiencyLevel: 'Intermediate',
        },
      },
      certifications: {
        create: {
          sortOrder: 0,
          name: 'AWS Cloud Practitioner',
          issuer: 'Amazon',
          year: 2025,
          credentialId: 'AWS-1',
        },
      },
    },
  });
}

function fileData(resume, overrides = {}) {
  const fileId = overrides.id ?? randomUUID();
  return {
    id: fileId,
    resumeId: resume.id,
    userId: resume.userId,
    originalFilename: 'Software_CV.pdf',
    storedFilename: generateStoredFilename(fileId, 'pdf'),
    contentType: 'application/pdf',
    byteSize: 4096,
    sha256: 'b'.repeat(64),
    ...overrides,
  };
}

before(async () => {
  baseline = await snapshot();
  ictSafety = await prisma.skill.findFirst({
    where: { sourceUri: ICT_SAFETY_URI, sourceSystem: 'ESCO' },
    select: { id: true, preferredLabel: true },
  });
  assert.ok(ictSafety, 'expected imported ICT safety skill');
});

after(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }
  const finalSnapshot = await snapshot();
  assert.deepEqual(finalSnapshot, baseline);
  await prisma.$disconnect();
});

test('resume_files is one-to-one with resumes and cascades from the owner resume', async () => {
  const fks = await prisma.$queryRaw`
    SELECT CAST(c.conname AS TEXT) AS conname, CAST(c.confdeltype AS TEXT) AS confdeltype
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'f'
      AND CAST(t.relname AS TEXT) = 'resume_files'
    ORDER BY 1
  `;
  const byName = Object.fromEntries(fks.map((row) => [row.conname, row.confdeltype]));
  assert.equal(byName.resume_files_resume_id_user_id_fkey, 'c');
  assert.equal(byName.resume_files_user_id_fkey, 'c');

  const unique = await prisma.$queryRaw`
    SELECT CAST(indexname AS TEXT) AS indexname
    FROM pg_indexes
    WHERE CAST(indexname AS TEXT) IN (
      'resume_files_resume_id_key',
      'resume_files_resume_id_user_id_key',
      'resumes_id_user_id_key'
    )
    ORDER BY 1
  `;
  assert.deepEqual(
    unique.map((row) => row.indexname),
    [
      'resume_files_resume_id_key',
      'resume_files_resume_id_user_id_key',
      'resumes_id_user_id_key',
    ],
  );
});

test('ResumeFile metadata cannot use another user id for an owned resume', async () => {
  const owner = await createCandidate('owner');
  const other = await createCandidate('other');
  const resume = await createResumeWithSections(owner);

  await assert.rejects(
    () =>
      prisma.resumeFile.create({
        data: fileData(resume, { userId: other.id }),
      }),
    (error) => error?.code === 'P2003',
  );

  const created = await prisma.resumeFile.create({ data: fileData(resume) });
  assert.equal(created.resumeId, resume.id);
  assert.equal(created.userId, owner.id);

  await assert.rejects(
    () =>
      prisma.resumeFile.create({
        data: fileData(resume, { id: randomUUID(), storedFilename: generateStoredFilename(randomUUID(), 'docx') }),
      }),
    (error) => error?.code === 'P2002',
  );
});

test('deleting a resume removes ResumeFile metadata and keeps nested sections until that delete', async () => {
  const owner = await createCandidate('cascade');
  const resume = await createResumeWithSections(owner);
  await prisma.resumeFile.create({ data: fileData(resume) });

  const beforeDelete = await prisma.resume.findUnique({
    where: { id: resume.id },
    include: {
      education: true,
      experience: true,
      skills: true,
      certifications: true,
      file: true,
    },
  });
  assert.equal(beforeDelete.education.length, 1);
  assert.equal(beforeDelete.experience.length, 1);
  assert.equal(beforeDelete.skills.length, 1);
  assert.equal(beforeDelete.certifications.length, 1);
  assert.equal(beforeDelete.file.originalFilename, 'Software_CV.pdf');
  assert.equal(beforeDelete.skills[0].skillId, ictSafety.id);

  const escoBefore = await prisma.skill.count();
  const mascoBefore = await prisma.mascoOccupationRecord.count();

  await prisma.resume.delete({ where: { id: resume.id } });

  assert.equal(await prisma.resumeFile.count({ where: { resumeId: resume.id } }), 0);
  assert.equal(await prisma.resumeEducation.count({ where: { resumeId: resume.id } }), 0);
  assert.equal(await prisma.resumeExperience.count({ where: { resumeId: resume.id } }), 0);
  assert.equal(await prisma.resumeSkill.count({ where: { resumeId: resume.id } }), 0);
  assert.equal(await prisma.resumeCertification.count({ where: { resumeId: resume.id } }), 0);
  assert.equal(await prisma.skill.count(), escoBefore);
  assert.equal(await prisma.mascoOccupationRecord.count(), mascoBefore);
  assert.equal(
    await prisma.skill.count({ where: { id: ictSafety.id, sourceSystem: 'ESCO' } }),
    1,
  );
});

test('creating ResumeFile does not rewrite existing resume sections', async () => {
  const owner = await createCandidate('preserve');
  const resume = await createResumeWithSections(owner);
  const before = await prisma.resume.findUnique({
    where: { id: resume.id },
    include: { education: true, experience: true, skills: true, certifications: true },
  });

  await prisma.resumeFile.create({ data: fileData(resume) });

  const afterFile = await prisma.resume.findUnique({
    where: { id: resume.id },
    include: { education: true, experience: true, skills: true, certifications: true, file: true },
  });
  assert.equal(afterFile.title, before.title);
  assert.equal(afterFile.education[0].institution, 'TAR UMT');
  assert.equal(afterFile.experience[0].organization, 'PeaceOne Labs');
  assert.equal(afterFile.skills[0].label, ictSafety.preferredLabel);
  assert.equal(afterFile.certifications[0].name, 'AWS Cloud Practitioner');
  assert.equal(afterFile.file.resumeId, resume.id);
  assert.notEqual(afterFile.file.storedFilename, afterFile.file.originalFilename);
});
