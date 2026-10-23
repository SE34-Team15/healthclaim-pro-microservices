import { PrismaClient, Role, UserStatus, ClaimCategory, ClaimStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for HealthClaim Pro...');

  const currentYear = new Date().getFullYear();
  const defaultPassword = await bcrypt.hash('Password123!', 10);

  // 0. Create Standard Corporate Departments
  console.log('Creating standard corporate departments...');
  const departments = [
    { code: 'ENG', name: 'Engineering & IT', description: 'Software engineering, DevOps, and cloud infrastructure' },
    { code: 'PROD', name: 'Product & Design', description: 'Product management, UX/UI, and user research' },
    { code: 'FIN', name: 'Finance & Treasury', description: 'Corporate treasury, accounting, and financial planning' },
    { code: 'HR', name: 'Human Resources', description: 'People operations, talent acquisition, and employee benefits' },
    { code: 'OPS', name: 'Operations & Logistics', description: 'Business operations and supply chain management' },
    { code: 'SALES', name: 'Sales & Marketing', description: 'Enterprise sales, brand strategy, and customer growth' },
    { code: 'LEGAL', name: 'Legal & Compliance', description: 'Corporate governance, contracts, and regulatory affairs' },
    { code: 'EXEC', name: 'Executive Management', description: 'C-Suite leadership and strategic operations' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: {
        code: dept.code,
        name: dept.name,
        description: dept.description,
        isActive: true,
      },
    });
  }

  // 1. Create Benefit Tiers
  console.log('Creating corporate benefit tiers...');
  const standardTier = await prisma.benefitTier.upsert({
    where: { code: 'TIER_STANDARD' },
    update: {},
    create: {
      name: 'Standard Corporate Plan',
      code: 'TIER_STANDARD',
      description: 'Standard medical coverage for full-time employees with 80% co-pay.',
      annualLimit: 3000.0,
      defaultDeductible: 100.0,
      defaultCoPayRate: 0.8,
      isActive: true,
    },
  });

  const executiveTier = await prisma.benefitTier.upsert({
    where: { code: 'TIER_EXECUTIVE' },
    update: {},
    create: {
      name: 'Executive Leadership Plan',
      code: 'TIER_EXECUTIVE',
      description: 'Enhanced medical coverage for senior management and leads with 90% co-pay.',
      annualLimit: 8000.0,
      defaultDeductible: 50.0,
      defaultCoPayRate: 0.9,
      isActive: true,
    },
  });

  const premiumTier = await prisma.benefitTier.upsert({
    where: { code: 'TIER_PREMIUM' },
    update: {},
    create: {
      name: 'Premium Global Care Plan',
      code: 'TIER_PREMIUM',
      description: 'Comprehensive global medical coverage with zero deductible and 95% co-pay.',
      annualLimit: 20000.0,
      defaultDeductible: 0.0,
      defaultCoPayRate: 0.95,
      isActive: true,
    },
  });

  // 2. Create Users for all 5 Enterprise RBAC Roles
  console.log('Creating demo users for 5 enterprise RBAC roles...');

  // System Administrator
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Engineering & IT' },
    create: {
      email: 'admin@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Alexander',
      lastName: 'Vance',
      role: Role.SYSTEM_ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Engineering & IT',
      isEmailVerified: true,
    },
  });

  // Claim Officer
  const officerUser = await prisma.user.upsert({
    where: { email: 'officer@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Operations & Logistics' },
    create: {
      email: 'officer@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      role: Role.CLAIM_OFFICER,
      status: UserStatus.ACTIVE,
      department: 'Operations & Logistics',
      isEmailVerified: true,
    },
  });

  // Finance Manager
  const financeUser = await prisma.user.upsert({
    where: { email: 'finance@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Finance & Treasury' },
    create: {
      email: 'finance@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Marcus',
      lastName: 'Sterling',
      role: Role.FINANCE_MANAGER,
      status: UserStatus.ACTIVE,
      department: 'Finance & Treasury',
      isEmailVerified: true,
    },
  });

  // Security Auditor
  const auditorUser = await prisma.user.upsert({
    where: { email: 'auditor@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Legal & Compliance' },
    create: {
      email: 'auditor@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Elena',
      lastName: 'Rostova',
      role: Role.SECURITY_AUDITOR,
      status: UserStatus.ACTIVE,
      department: 'Legal & Compliance',
      isEmailVerified: true,
    },
  });

  // Standard Employee
  const employeeUser = await prisma.user.upsert({
    where: { email: 'employee@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Engineering & IT' },
    create: {
      email: 'employee@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'David',
      lastName: 'Miller',
      role: Role.EMPLOYEE,
      status: UserStatus.ACTIVE,
      department: 'Engineering & IT',
      isEmailVerified: true,
    },
  });

  // Executive Employee
  const execEmployee = await prisma.user.upsert({
    where: { email: 'executive@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Executive Management' },
    create: {
      email: 'executive@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Sophia',
      lastName: 'Chen',
      role: Role.EMPLOYEE,
      status: UserStatus.ACTIVE,
      department: 'Executive Management',
      isEmailVerified: true,
    },
  });

  // Departmental Staff for cross-department loss-ratio & analytics
  const prodEmployee = await prisma.user.upsert({
    where: { email: 'product.lead@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Product & Design' },
    create: {
      email: 'product.lead@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Lucas',
      lastName: 'Vance',
      role: Role.EMPLOYEE,
      status: UserStatus.ACTIVE,
      department: 'Product & Design',
      isEmailVerified: true,
    },
  });

  const salesEmployee = await prisma.user.upsert({
    where: { email: 'sales.lead@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Sales & Marketing' },
    create: {
      email: 'sales.lead@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Chloe',
      lastName: 'Bennett',
      role: Role.EMPLOYEE,
      status: UserStatus.ACTIVE,
      department: 'Sales & Marketing',
      isEmailVerified: true,
    },
  });

  const hrEmployee = await prisma.user.upsert({
    where: { email: 'hr.specialist@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Human Resources' },
    create: {
      email: 'hr.specialist@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'James',
      lastName: 'Wilson',
      role: Role.EMPLOYEE,
      status: UserStatus.ACTIVE,
      department: 'Human Resources',
      isEmailVerified: true,
    },
  });

  const opsEmployee = await prisma.user.upsert({
    where: { email: 'ops.lead@healthclaim.pro' },
    update: { passwordHash: defaultPassword, department: 'Operations & Logistics' },
    create: {
      email: 'ops.lead@healthclaim.pro',
      passwordHash: defaultPassword,
      firstName: 'Daniel',
      lastName: 'Kim',
      role: Role.EMPLOYEE,
      status: UserStatus.ACTIVE,
      department: 'Operations & Logistics',
      isEmailVerified: true,
    },
  });

  // 3. Assign Quotas for Employees (Strictly EMPLOYEE role only)
  console.log('Assigning initial policy quotas for current fiscal year (Employees Only)...');

  // Purge any quota records for non-employee roles
  await prisma.userPolicyQuota.deleteMany({
    where: {
      user: {
        role: {
          not: Role.EMPLOYEE,
        },
      },
    },
  });

  const employeeQuotaConfigs = [
    { user: employeeUser, tier: standardTier, remaining: 1640.0, deductibleSpent: 100.0 },
    { user: execEmployee, tier: executiveTier, remaining: 7415.0, deductibleSpent: 50.0 },
    { user: prodEmployee, tier: standardTier, remaining: 2776.0, deductibleSpent: 100.0 },
    { user: salesEmployee, tier: standardTier, remaining: 2664.0, deductibleSpent: 100.0 },
    { user: hrEmployee, tier: standardTier, remaining: 2824.0, deductibleSpent: 100.0 },
    { user: opsEmployee, tier: standardTier, remaining: 3000.0, deductibleSpent: 0.0 },
  ];

  for (const eq of employeeQuotaConfigs) {
    await prisma.userPolicyQuota.upsert({
      where: {
        userId_fiscalYear: {
          userId: eq.user.id,
          fiscalYear: currentYear,
        },
      },
      update: {
        annualLimit: eq.tier.annualLimit,
        remainingBalance: eq.remaining,
        cumulativeDeductibleSpent: eq.deductibleSpent,
      },
      create: {
        userId: eq.user.id,
        benefitTierId: eq.tier.id,
        fiscalYear: currentYear,
        annualLimit: eq.tier.annualLimit,
        remainingBalance: eq.remaining,
        cumulativeDeductibleSpent: eq.deductibleSpent,
      },
    });
  }

  // 4. Seed Dynamic Compliance Rules (AST format)
  console.log('Seeding compliance rule AST definitions...');

  const rules = [
    {
      code: 'RULE_HOSPITAL_GRADE',
      name: 'Accredited Healthcare Provider Requirement',
      description: 'Medical services must be rendered by accredited Grade 3A, Grade A, or certified Specialist Clinics for straight-through auto-validation.',
      priority: 10,
      astDefinition: {
        type: 'COMPARISON',
        field: 'hospitalGrade',
        operator: 'IN',
        value: ['GRADE_3A', 'GRADE_A', 'SPECIALIST_CLINIC'],
      },
    },
    {
      code: 'RULE_DENTAL_CAP',
      name: 'Dental Single Claim Cap',
      description: 'Individual dental reimbursement claims must not exceed $1,000 without prior specialized authorization.',
      priority: 20,
      astDefinition: {
        type: 'LOGICAL',
        operator: 'OR',
        children: [
          { type: 'COMPARISON', field: 'category', operator: 'NOT_EQUALS', value: 'DENTAL' },
          { type: 'COMPARISON', field: 'totalAmount', operator: 'LESS_EQUAL', value: 1000 },
        ],
      },
    },
    {
      code: 'RULE_MIN_AMOUNT',
      name: 'Minimum Claim Value Validation',
      description: 'Total claim amount must be strictly greater than $0 and have positive line-item totals.',
      priority: 30,
      astDefinition: {
        type: 'COMPARISON',
        field: 'totalAmount',
        operator: 'GREATER_THAN',
        value: 0,
      },
    },
  ];

  for (const r of rules) {
    await prisma.complianceRule.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, astDefinition: r.astDefinition },
      create: {
        code: r.code,
        name: r.name,
        description: r.description,
        priority: r.priority,
        astDefinition: r.astDefinition,
        isActive: true,
      },
    });
  }

  // 5. Seed Realistic Multi-Department Claims with Itemizations & AST Logs (Singapore Context)
  console.log('Seeding realistic multi-department claim trajectories (Singapore Healthcare MOH Framework)...');

  // Clean out any old claims to ensure 100% fresh, consistent Singapore healthcare data
  await prisma.claim.deleteMany();

  const seedClaims = [
    {
      claimNumber: 'CLM-2026-ENG01',
      user: employeeUser,
      category: ClaimCategory.HOSPITALIZATION,
      hospitalName: 'Singapore General Hospital (SGH)',
      hospitalGrade: 'GRADE_3A',
      invoiceDate: new Date('2026-06-15T09:00:00Z'),
      createdAt: new Date('2026-06-18T09:00:00Z'),
      reviewedAt: new Date('2026-06-18T13:15:00Z'), // 4.25 hours review latency
      totalAmount: 1200.0,
      deductibleCovered: 100.0,
      coPayRate: 0.8,
      approvedAmount: 880.0,
      outOfPocketAmount: 320.0,
      status: ClaimStatus.SETTLED,
      statusReason: 'Inpatient recovery subsidy settled via corporate treasury.',
      reviewedBy: financeUser.id,
      items: [
        { description: 'Acute Inpatient Hospitalization (2 nights)', category: ClaimCategory.HOSPITALIZATION, unitPrice: 900.0, quantity: 1, totalPrice: 900.0 },
        { description: 'Diagnostic Radiology & CT Scan', category: ClaimCategory.HOSPITALIZATION, unitPrice: 300.0, quantity: 1, totalPrice: 300.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-ENG02',
      user: employeeUser,
      category: ClaimCategory.DENTAL,
      hospitalName: 'Novena Specialist Dental Care',
      hospitalGrade: 'SPECIALIST_CLINIC',
      invoiceDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-22T10:00:00Z'),
      reviewedAt: new Date('2026-07-22T12:30:00Z'), // 2.5 hours review latency
      totalAmount: 350.0,
      deductibleCovered: 0.0,
      coPayRate: 0.8,
      approvedAmount: 280.0,
      outOfPocketAmount: 70.0,
      status: ClaimStatus.OFFICER_APPROVED,
      statusReason: 'Dental prophylaxis & root canal approved by Officer.',
      reviewedBy: officerUser.id,
      items: [
        { description: 'Root Canal Endodontic Therapy', category: ClaimCategory.DENTAL, unitPrice: 250.0, quantity: 1, totalPrice: 250.0 },
        { description: 'Preventative Ultrasonic Dental Scaling', category: ClaimCategory.DENTAL, unitPrice: 100.0, quantity: 1, totalPrice: 100.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-ENG03',
      user: employeeUser,
      category: ClaimCategory.CONSULTATION,
      hospitalName: 'National University Hospital (NUH) Outpatient Clinic',
      hospitalGrade: 'GRADE_3A',
      invoiceDate: new Date('2026-08-10T14:20:00Z'),
      createdAt: new Date('2026-08-10T14:20:00Z'),
      reviewedAt: new Date('2026-08-10T14:20:05Z'), // Straight through in 5 seconds
      totalAmount: 250.0,
      deductibleCovered: 0.0,
      coPayRate: 0.8,
      approvedAmount: 200.0,
      outOfPocketAmount: 50.0,
      status: ClaimStatus.AUTO_VALIDATED,
      statusReason: 'Straight-through auto-validation passed all AST compliance checks.',
      items: [
        { description: 'Specialist Outpatient Consultation', category: ClaimCategory.CONSULTATION, unitPrice: 150.0, quantity: 1, totalPrice: 150.0 },
        { description: 'Prescription Pharmaceuticals', category: ClaimCategory.MEDICATION, unitPrice: 100.0, quantity: 1, totalPrice: 100.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-EXEC01',
      user: execEmployee,
      category: ClaimCategory.HEALTH_SCREENING,
      hospitalName: 'Gleneagles Hospital Executive Health Clinic',
      hospitalGrade: 'GRADE_A',
      invoiceDate: new Date('2026-05-12T08:30:00Z'),
      createdAt: new Date('2026-05-15T08:30:00Z'),
      reviewedAt: new Date('2026-05-15T10:00:00Z'), // 1.5 hours review latency
      totalAmount: 650.0,
      deductibleCovered: 50.0,
      coPayRate: 0.9,
      approvedAmount: 540.0,
      outOfPocketAmount: 110.0,
      status: ClaimStatus.SETTLED,
      statusReason: 'Executive comprehensive wellness screening settled.',
      reviewedBy: financeUser.id,
      items: [
        { description: 'Executive Comprehensive Biomarker Panel', category: ClaimCategory.HEALTH_SCREENING, unitPrice: 450.0, quantity: 1, totalPrice: 450.0 },
        { description: 'Cardiovascular Stress & ECG Assessment', category: ClaimCategory.HEALTH_SCREENING, unitPrice: 200.0, quantity: 1, totalPrice: 200.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-PROD01',
      user: prodEmployee,
      category: ClaimCategory.OPTICAL,
      hospitalName: 'Mount Elizabeth Specialist Eye & Vision Centre',
      hospitalGrade: 'SPECIALIST_CLINIC',
      invoiceDate: new Date('2026-06-25T11:00:00Z'),
      createdAt: new Date('2026-06-28T11:00:00Z'),
      reviewedAt: new Date('2026-06-28T13:45:00Z'), // 2.75 hours review latency
      totalAmount: 280.0,
      deductibleCovered: 100.0,
      coPayRate: 0.8,
      approvedAmount: 144.0,
      outOfPocketAmount: 136.0,
      status: ClaimStatus.SETTLED,
      statusReason: 'Prescription optical correction settled.',
      reviewedBy: financeUser.id,
      items: [
        { description: 'Refractive Corneal & Optical Examination', category: ClaimCategory.OPTICAL, unitPrice: 80.0, quantity: 1, totalPrice: 80.0 },
        { description: 'Prescription Corrective Lenses', category: ClaimCategory.OPTICAL, unitPrice: 200.0, quantity: 1, totalPrice: 200.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-SALES01',
      user: salesEmployee,
      category: ClaimCategory.CONSULTATION,
      hospitalName: 'SingHealth Polyclinic & Community Hospital',
      hospitalGrade: 'PUBLIC_HOSPITAL',
      invoiceDate: new Date('2026-08-05T09:30:00Z'),
      createdAt: new Date('2026-08-08T09:30:00Z'),
      reviewedAt: new Date('2026-08-08T12:00:00Z'), // 2.5 hours review latency
      totalAmount: 420.0,
      deductibleCovered: 100.0,
      coPayRate: 0.8,
      approvedAmount: 256.0,
      outOfPocketAmount: 164.0,
      status: ClaimStatus.FINANCE_APPROVED,
      statusReason: 'Approved by Finance, scheduled in next weekly payout run.',
      reviewedBy: financeUser.id,
      items: [
        { description: 'Urgent Care Outpatient Triage & Treatment', category: ClaimCategory.CONSULTATION, unitPrice: 220.0, quantity: 1, totalPrice: 220.0 },
        { description: 'Antibiotic Therapy & Medications', category: ClaimCategory.MEDICATION, unitPrice: 200.0, quantity: 1, totalPrice: 200.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-HR01',
      user: hrEmployee,
      category: ClaimCategory.CONSULTATION,
      hospitalName: 'Tan Tock Seng Hospital (TTSH) Specialist Outpatient Clinic',
      hospitalGrade: 'GRADE_3A',
      invoiceDate: new Date('2026-07-15T14:00:00Z'),
      createdAt: new Date('2026-07-18T14:00:00Z'),
      reviewedAt: new Date('2026-07-18T16:15:00Z'), // 2.25 hours review latency
      totalAmount: 220.0,
      deductibleCovered: 100.0,
      coPayRate: 0.8,
      approvedAmount: 96.0,
      outOfPocketAmount: 124.0,
      status: ClaimStatus.SETTLED,
      statusReason: 'Outpatient consultation reimbursed.',
      reviewedBy: financeUser.id,
      items: [
        { description: 'Dermatology Consultation & Prescription', category: ClaimCategory.CONSULTATION, unitPrice: 220.0, quantity: 1, totalPrice: 220.0 },
      ],
    },
    {
      claimNumber: 'CLM-2026-OPS01',
      user: opsEmployee,
      category: ClaimCategory.DENTAL,
      hospitalName: 'Raffles Medical Family Dental Clinic',
      hospitalGrade: 'COMMUNITY_CLINIC',
      invoiceDate: new Date('2026-08-22T15:00:00Z'),
      createdAt: new Date('2026-08-22T15:00:00Z'),
      reviewedAt: null, // Pending officer review
      totalAmount: 1250.0,
      deductibleCovered: 0.0,
      coPayRate: 0.8,
      approvedAmount: 0.0,
      outOfPocketAmount: 1250.0,
      status: ClaimStatus.FLAGGED_REVIEW,
      statusReason: 'Triggered RULE_DENTAL_CAP (Exceeds $1,000 dental threshold). Pending officer adjudication.',
      items: [
        { description: 'Complex Titanium Dental Implant Surgery', category: ClaimCategory.DENTAL, unitPrice: 1250.0, quantity: 1, totalPrice: 1250.0 },
      ],
    },
  ];

  for (const sc of seedClaims) {
    const existingClaim = await prisma.claim.findUnique({
      where: { claimNumber: sc.claimNumber },
    });

    if (!existingClaim) {
      const createdClaim = await prisma.claim.create({
        data: {
          claimNumber: sc.claimNumber,
          userId: sc.user.id,
          fiscalYear: currentYear,
          category: sc.category,
          hospitalName: sc.hospitalName,
          hospitalGrade: sc.hospitalGrade,
          invoiceDate: sc.invoiceDate,
          createdAt: sc.createdAt,
          totalAmount: sc.totalAmount,
          deductibleCovered: sc.deductibleCovered,
          coPayRate: sc.coPayRate,
          approvedAmount: sc.approvedAmount,
          outOfPocketAmount: sc.outOfPocketAmount,
          status: sc.status,
          statusReason: sc.statusReason,
          reviewedBy: sc.reviewedBy,
          reviewedAt: sc.reviewedAt,
          items: {
            create: sc.items.map((it) => ({
              description: it.description,
              category: it.category,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              totalPrice: it.totalPrice,
              isEligible: true,
            })),
          },
        },
      });

      // Add Rule Evaluation Logs for AST telemetry
      const isHospitalAccredited = ['GRADE_3A', 'GRADE_A', 'SPECIALIST_CLINIC'].includes(sc.hospitalGrade);
      await prisma.ruleEvaluationLog.create({
        data: {
          claimId: createdClaim.id,
          ruleCode: 'RULE_HOSPITAL_GRADE',
          ruleName: 'Accredited Healthcare Provider Requirement',
          isPassed: isHospitalAccredited,
          reason: isHospitalAccredited
            ? 'Healthcare provider accredited (Grade A / 3A / Specialist Clinic)'
            : 'Unaccredited community clinic or general provider requires manual review',
        },
      });

      await prisma.ruleEvaluationLog.create({
        data: {
          claimId: createdClaim.id,
          ruleCode: 'RULE_DENTAL_CAP',
          ruleName: 'Dental Single Claim Cap',
          isPassed: sc.category !== ClaimCategory.DENTAL || sc.totalAmount <= 1000,
          reason: sc.category === ClaimCategory.DENTAL && sc.totalAmount > 1000 ? 'Dental claim exceeds $1,000 threshold' : 'Complies with dental cap',
        },
      });
    }
  }

  // 6. Initial Seed Audit Log
  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_INITIALIZATION',
      targetResource: 'DATABASE_SEED',
      details: {
        initializedRoles: Object.values(Role),
        seededUsersCount: 10,
        seededTiersCount: 3,
        seededRulesCount: 3,
        seededClaimsCount: seedClaims.length,
        fiscalYear: currentYear,
      },
    },
  });

  console.log('✅ Seeding completed successfully!');
  console.log('Default credentials for all users: Password123!');
  console.log('- Admin: admin@healthclaim.pro');
  console.log('- Claim Officer: officer@healthclaim.pro');
  console.log('- Finance Manager: finance@healthclaim.pro');
  console.log('- Security Auditor: auditor@healthclaim.pro');
  console.log('- Employee: employee@healthclaim.pro');
  console.log('- Executive: executive@healthclaim.pro');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
