import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo user
  const passwordHash = await bcrypt.hash('Demo123!', 12);
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@ukjobsinsider.com' },
    update: {},
    create: {
      email: 'demo@ukjobsinsider.com',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      weeklyTarget: 10,
      monthlyTarget: 40,
      consentTracking: true,
      consentAnalytics: true,
      profileData: {
        onboardingCompleted: true,
        preferredJobBoards: ['LinkedIn', 'Indeed', 'Reed'],
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
        targetSalary: '£60,000+',
      },
    },
  });

  console.log(`✓ Created user: ${user.email}`);

  // Create CV versions
  const cvVersions = await Promise.all([
    prisma.cVVersion.create({
      data: {
        userId: user.id,
        name: 'Tech CV',
        version: 1,
        fileName: 'demo_tech_cv_v1.pdf',
        isActive: true,
        totalApplications: 25,
        successfulApps: 8,
      },
    }),
    prisma.cVVersion.create({
      data: {
        userId: user.id,
        name: 'General CV',
        version: 1,
        fileName: 'demo_general_cv_v1.pdf',
        isActive: false,
        totalApplications: 15,
        successfulApps: 3,
      },
    }),
  ]);

  console.log(`✓ Created ${cvVersions.length} CV versions`);

  // Create sample applications
  const statuses = [
    'APPLIED',
    'VIEWED',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'INTERVIEWED',
    'OFFERED',
    'REJECTED',
  ] as const;

  const jobBoards = ['LinkedIn', 'Indeed', 'Reed', 'Totaljobs', 'Direct'];
  const companies = [
    'Tech Corp', 'Data Insights Ltd', 'Cloud Solutions', 'Digital Agency', 'AI Ventures',
    'Tech StartUp', 'Software Inc', 'Dev Studios', 'Innovate Ltd', 'Code Masters',
  ];

  const applications = [];
  const now = new Date();
  
  for (let i = 0; i < 45; i++) {
    const appliedAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const cvVersion = cvVersions[Math.floor(Math.random() * cvVersions.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        company: companies[Math.floor(Math.random() * companies.length)],
        position: ['Senior Developer', 'Software Engineer', 'Full Stack Developer', 'Backend Engineer', 'Frontend Developer'][Math.floor(Math.random() * 5)],
        location: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Remote'][Math.floor(Math.random() * 6)],
        jobBoardSource: jobBoards[Math.floor(Math.random() * jobBoards.length)],
        jobUrl: `https://example.com/jobs/${i + 1}`,
        salary: ['£50,000 - £60,000', '£60,000 - £70,000', '£70,000+'][Math.floor(Math.random() * 3)],
        status,
        appliedAt,
        timeSpent: Math.floor(Math.random() * 600 + 300), // 5-15 minutes
        cvVersionId: cvVersion.id,
        coverLetter: Math.random() > 0.5,
        notes: Math.random() > 0.7 ? 'Great opportunity, followed up' : undefined,
        captureMethod: 'EXTENSION',
        responseDate: status !== 'APPLIED' ? new Date(appliedAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined,
      },
    });
    
    applications.push(application);
    
    // Create application event
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'APPLICATION_CREATED',
        data: {
          source: 'EXTENSION',
          confidence: 0.95,
        },
      },
    });
    
    // Add status change events
    if (status !== 'APPLIED') {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: 'STATUS_CHANGED',
          data: {
            from: 'APPLIED',
            to: status,
          },
        },
      });
    }
  }

  console.log(`✓ Created ${applications.length} applications`);

  // Create active streak
  await prisma.streak.create({
    data: {
      userId: user.id,
      currentDays: Math.floor(Math.random() * 10 + 1),
      longestDays: 12,
      isActive: true,
      startDate: new Date(now.getTime() - Math.random() * 10 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`✓ Created streak data`);

  // Create user analytics
  const totalApplications = applications.length;
  const responded = applications.filter(app => app.responseDate).length;
  const interviewed = applications.filter(app => ['INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'].includes(app.status)).length;

  const avgSeconds = Math.round(
    applications.reduce((sum, app) => sum + (app.timeSpent || 0), 0) / Math.max(totalApplications, 1)
  );

  await prisma.userAnalytics.create({
    data: {
      userId: user.id,
      date: new Date(),
      applicationsCount: totalApplications,
      responses: responded,
      interviews: interviewed,
      avgTimePerApp: avgSeconds,
      coldEmailsSent: 0,
      targetAchievement: totalApplications > 0 ? (responded / totalApplications) * 100 : null,
      topSource: 'LinkedIn',
      peakHour: 14,
    },
  });

  console.log(`✓ Created analytics data`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📝 Demo credentials:');
  console.log('  Email: demo@ukjobsinsider.com');
  console.log('  Password: Demo123!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

