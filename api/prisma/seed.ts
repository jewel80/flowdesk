/* eslint-disable no-console */
import {
  AuditAction,
  BillingRequestStatus,
  InvoiceStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Shared demo password for every seeded account. */
const DEMO_PASSWORD = 'password123';

// Realistic customer names and companies
const CUSTOMERS = [
  'Northwind Traders',
  'Contoso Ltd',
  'Fabrikam Inc',
  'Adventure Works',
  'Tailspin Toys',
  'Wingtip Toys',
  'Adventure Works Cycles',
  'Alpine Ski House',
  'Blue Yonder Airlines',
  'City Power & Light',
  'Consolidated Messenger',
  'Coho Winery',
  'Contoso Pharmaceuticals',
  'Contoso Realty',
  'Contoso, Ltd.',
  'DXC - Data Corporation',
  'E découvrir Inc.',
  'Fictitious, Inc.',
  'Fourth Coffee',
  'Graphic Design Institute',
  'Humongous',
  'Lucerne Publishing',
  'Nod Publishers',
  'Proseware, Inc.',
  'Contoso Suites',
  'Southridge Video',
  'The Phone Company',
  'Trey Research',
  'Van Sidder Electronics',
  'Wide World Importers',
  'Yunnan Bike (China) Ltd.',
  'Zip Inc.',
];

const REQUEST_TITLES = [
  'Q{quarter} Consulting Retainer',
  'Annual License Renewal',
  'Cloud Migration - Phase {phase}',
  'Security Audit Engagement',
  'On-site Training Workshop',
  'Software Development Project',
  'Database Optimization',
  'Network Infrastructure Upgrade',
  'Cybersecurity Assessment',
  'Compliance Review Services',
  'Data Analytics Platform',
  'Custom CRM Implementation',
  'E-commerce Solution',
  'Mobile App Development',
  'API Integration Services',
  'Performance Testing Services',
  'Infrastructure Audit',
  'DevOps Consulting',
  'Technical Documentation',
  'Legacy System Migration',
  'Business Intelligence Setup',
  'Data Warehouse Implementation',
  'Machine Learning Pipeline',
  'IoT Solution Design',
  'Blockchain Consulting',
  'Digital Transformation Strategy',
  'IT Project Management',
  'Software Architecture Review',
  'Penetration Testing Services',
  'Vulnerability Assessment',
  'Security Awareness Training',
  'Compliance Gap Analysis',
];

const DESCRIPTIONS = [
  'Professional services with comprehensive documentation and support.',
  'End-to-end solution with 24/7 support and maintenance.',
  'Scalable architecture designed for enterprise-grade performance.',
  'Expert team with proven track record in similar projects.',
  'Agile methodology with regular sprint reviews and adjustments.',
  'Industry-standard practices with regulatory compliance built-in.',
  'Custom solution tailored to specific business requirements.',
  'Turnkey implementation with training and knowledge transfer.',
  'Ongoing support and maintenance options available.',
  'Proven methodology delivering measurable business results.',
];

// Helper function to generate realistic amounts (avoid round numbers)
function generateAmountCents(): number {
  const base = Math.floor(Math.random() * 1000000) + 50000; // 500-10,000 base range
  const variance = Math.floor(Math.random() * 10000); // Add some variance
  return base + variance;
}

// Helper function to generate date within range
function randomDate(startDate: Date, endDate: Date): Date {
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
}

// Helper function to add days to date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to get day of week (0 = Sunday, 6 = Saturday)
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

async function main(): Promise<void> {
  console.log('🌱 Seeding FlowDesk realistic demo data...');

  // Idempotent: wipe transactional data so re-running yields a clean dataset.
  await prisma.auditLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billingRequest.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [sara, samir, aaron, maria] = await Promise.all([
    upsertUser('sales@flowdesk.dev', 'Sara (Sales)', Role.SALES, passwordHash),
    upsertUser('sales2@flowdesk.dev', 'Samir (Sales)', Role.SALES, passwordHash),
    upsertUser('accounts@flowdesk.dev', 'Aaron (Accounts)', Role.ACCOUNTS, passwordHash),
    upsertUser('manager@flowdesk.dev', 'Maria (Manager)', Role.MANAGER, passwordHash),
  ]);

  const users = { sara, samir, aaron, maria };

  // Generate 12 months of historical data
  const endDate = new Date();
  const startDate = addDays(endDate, -365); // 12 months back

  console.log('📅 Generating 12 months of historical data...');

  const totalRequests = 120; // Target ~10 requests per month
  const requestsPerMonth = Math.floor(totalRequests / 12);

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthStart = addDays(startDate, monthOffset * 30);
    const monthEnd = addDays(monthStart, 30);
    const currentMonth = monthStart.getMonth();
    const currentYear = monthStart.getFullYear();

    console.log(`   Month ${currentMonth + 1}/${currentYear}...`);

    // Generate requests for this month
    const monthRequests = Math.floor(requestsPerMonth + (Math.random() * 4 - 2)); // 8-12 requests per month

    for (let i = 0; i < monthRequests; i++) {
      // Bias towards weekdays (business days)
      const requestDate = randomDate(monthStart, monthEnd);
      let adjustedDate = requestDate;
      if (getDayOfWeek(requestDate) === 0 || getDayOfWeek(requestDate) === 6) {
        // If weekend, move to nearest weekday
        adjustedDate = addDays(requestDate, getDayOfWeek(requestDate) === 0 ? 1 : -1);
      }

      // Determine status and create lifecycle
      const statusRoll = Math.random();
      let status: BillingRequestStatus;
      let lifecycleTrail: any[] = [];
      let invoiceData: any = null;

      // Base status distribution
      if (statusRoll < 0.15) {
        status = BillingRequestStatus.DRAFT;
        lifecycleTrail = [
          { action: AuditAction.CREATED, actor: getRandomUser(users, 'sales'), toStatus: BillingRequestStatus.DRAFT },
        ];
      } else if (statusRoll < 0.35) {
        status = BillingRequestStatus.SUBMITTED;
        lifecycleTrail = [
          { action: AuditAction.CREATED, actor: getRandomUser(users, 'sales'), toStatus: BillingRequestStatus.DRAFT },
          {
            action: AuditAction.SUBMITTED,
            actor: getRandomUser(users, 'sales'),
            fromStatus: BillingRequestStatus.DRAFT,
            toStatus: BillingRequestStatus.SUBMITTED,
          },
        ];
      } else if (statusRoll < 0.55) {
        status = BillingRequestStatus.APPROVED;
        const reviewer = users.aaron;
        lifecycleTrail = [
          { action: AuditAction.CREATED, actor: getRandomUser(users, 'sales'), toStatus: BillingRequestStatus.DRAFT },
          {
            action: AuditAction.SUBMITTED,
            actor: getRandomUser(users, 'sales'),
            fromStatus: BillingRequestStatus.DRAFT,
            toStatus: BillingRequestStatus.SUBMITTED,
          },
          {
            action: AuditAction.APPROVED,
            actor: reviewer,
            fromStatus: BillingRequestStatus.SUBMITTED,
            toStatus: BillingRequestStatus.APPROVED,
          },
        ];

        // 70% of approved get invoiced
        if (Math.random() < 0.7) {
          status = BillingRequestStatus.INVOICED;
          lifecycleTrail.push({
            action: AuditAction.INVOICE_GENERATED,
            actor: reviewer,
            fromStatus: BillingRequestStatus.APPROVED,
            toStatus: BillingRequestStatus.INVOICED,
            note: 'Invoice generated',
          });

          // 60% of invoiced get paid (some later)
          const paidChance = Math.random();
          const invoiceStatus = paidChance < 0.4 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED;
          invoiceData = { status: invoiceStatus };

          if (invoiceStatus === InvoiceStatus.PAID) {
            lifecycleTrail.push({
              action: AuditAction.INVOICE_PAID,
              actor: reviewer,
              note: 'Invoice marked as paid',
            });
          }
        }
      } else {
        status = BillingRequestStatus.REJECTED;
        const reviewer = users.aaron;
        lifecycleTrail = [
          { action: AuditAction.CREATED, actor: getRandomUser(users, 'sales'), toStatus: BillingRequestStatus.DRAFT },
          {
            action: AuditAction.SUBMITTED,
            actor: getRandomUser(users, 'sales'),
            fromStatus: BillingRequestStatus.DRAFT,
            toStatus: BillingRequestStatus.SUBMITTED,
          },
          {
            action: AuditAction.REJECTED,
            actor: reviewer,
            fromStatus: BillingRequestStatus.SUBMITTED,
            toStatus: BillingRequestStatus.REJECTED,
            note: getRejectionReason(),
          },
        ];
      }

      await createRealisticRequest({
        title: generateRequestTitle(currentMonth),
        customerName: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)],
        amountCents: generateAmountCents(),
        description: DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)],
        status,
        createdBy: getRandomUser(users, 'sales'),
        reviewedBy: status === BillingRequestStatus.APPROVED || status === BillingRequestStatus.REJECTED ? users.aaron : undefined,
        rejectionReason: status === BillingRequestStatus.REJECTED ? getRejectionReason() : undefined,
        invoice: invoiceData,
        trail: lifecycleTrail,
        requestDate: adjustedDate,
      });
    }
  }

  console.log('✅ Seed complete! Demo accounts (password: %s):', DEMO_PASSWORD);
  console.table([
    { email: sara.email, role: sara.role },
    { email: samir.email, role: samir.role },
    { email: aaron.email, role: aaron.role },
    { email: maria.email, role: maria.role },
  ]);
  console.log(`📊 Generated ${totalRequests} billing requests over 12 months`);
  console.log(`📈 Multiple statuses distributed across ${365} days`);
}

function upsertUser(
  email: string,
  name: string,
  role: Role,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash },
    create: { email, name, role, passwordHash },
  });
}

function getRandomUser(users: any, roleHint?: string): any {
  const salesUsers = [users.sara, users.samir];
  if (roleHint === 'sales') {
    return salesUsers[Math.floor(Math.random() * salesUsers.length)];
  }
  return users[Object.values(users)[Math.floor(Math.random() * Object.values(users).length)]];
}

function generateRequestTitle(month: number): string {
  const quarter = Math.floor(month / 3) + 1;
  const titleTemplate = REQUEST_TITLES[Math.floor(Math.random() * REQUEST_TITLES.length)];
  return titleTemplate.replace('{quarter}', quarter.toString()).replace('{phase}', String(Math.floor(Math.random() * 5) + 1));
}

function getRejectionReason(): string {
  const reasons = [
    'Missing required documentation. Please provide complete SOW.',
    'Amount exceeds authorized limit. Please revise.',
    'Customer credit hold on file. Clear before resubmitting.',
    'Technical specifications unclear. Please elaborate.',
    'Duplicate request. Another request already covers this work.',
    'Incomplete scope definition. Please provide full details.',
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

interface RealisticRequestInput {
  title: string;
  customerName: string;
  amountCents: number;
  description?: string;
  status: BillingRequestStatus;
  createdBy: any;
  reviewedBy?: any;
  rejectionReason?: string;
  invoice?: { status: InvoiceStatus };
  trail: any[];
  requestDate: Date;
}

async function createRealisticRequest(input: RealisticRequestInput): Promise<void> {
  // Create the request with backdated createdAt
  const request = await prisma.billingRequest.create({
    data: {
      title: input.title,
      customerName: input.customerName,
      amountCents: input.amountCents,
      currency: 'USD',
      description: input.description,
      status: input.status,
      rejectionReason: input.rejectionReason,
      createdById: input.createdBy.id,
      reviewedById: input.reviewedBy?.id,
      // Backdate the createdAt to the request date
      createdAt: input.requestDate,
      reviewedAt: input.reviewedBy ? input.requestDate : undefined,
    },
  });

  // Create invoice if present
  if (input.invoice) {
    const dueDate = new Date(input.requestDate);
    dueDate.setDate(dueDate.getDate() + 30);

    // Calculate totals for the new schema
    const subtotalCents = input.amountCents;
    const discountCents = Math.floor(Math.random() * 50000); // Random discount up to $500
    const taxRatePercent = Math.floor(Math.random() * 10) === 0 ? 0 : Math.floor(Math.random() * 8) + 5; // 0%, 5-12%
    const taxAmountCents = Math.floor((subtotalCents - discountCents) * (taxRatePercent / 100));
    const totalCents = subtotalCents - discountCents + taxAmountCents;

    // Generate realistic line items (1-3 items)
    const lineItemCount = Math.floor(Math.random() * 3) + 1;
    const lineItems = [];
    let lineTotal = 0;

    for (let i = 0; i < lineItemCount; i++) {
      const lineAmountCents = Math.floor((input.amountCents - discountCents) / lineItemCount);
      lineItems.push({
        description: generateLineItemDescription(input.title, i + 1, lineItemCount),
        quantity: 1,
        unitPriceCents: lineAmountCents,
        amountCents: lineAmountCents,
        sortOrder: i,
      });
      lineTotal += lineAmountCents;
    }

    await prisma.invoice.create({
      data: {
        amountCents: input.amountCents,
        currency: 'USD',
        status: input.invoice.status,
        dueDate,
        paidAt: input.invoice.status === InvoiceStatus.PAID ? input.requestDate : null,
        billingRequestId: request.id,
        // New required fields
        billToName: input.customerName,
        billToAddress: `${Math.floor(Math.random() * 900 + 100)} ${CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)]} Blvd`,
        billToEmail: `contact@${input.customerName.toLowerCase().replace(/\s+/g, '')}.com`,
        billToPhone: `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        issuerName: 'FlowDesk Inc.',
        issuerAddress: '123 Business St, Suite 100, San Francisco, CA 94105',
        issuerTaxId: 'FEIN123456789',
        issuerEmail: 'billing@flowdesk.com',
        issuerPhone: '+1-555-123-4567',
        subtotalCents,
        discountCents,
        taxRatePercent,
        taxAmountCents,
        totalCents,
        paymentTerms: `Net ${30 + Math.floor(Math.random() * 30)}`, // Net 30-60
        notes: 'Thank you for your business. We appreciate your prompt payment.',
        bankAccountName: 'FlowDesk Business Banking',
        bankAccountNumber: `****${Math.floor(Math.random() * 10000)}`,
        bankName: 'Business Bank International',
        bankSwiftOrRouting: 'FWBKUS6S',
        lineItems: {
          create: lineItems,
        },
        // Backdate invoice date
        issuedAt: input.requestDate,
        createdAt: input.requestDate,
      },
    });
  }

  // Create audit trail with backdated timestamps
  for (const entry of input.trail) {
    // Calculate appropriate delay for each action
    const actionDelay = calculateActionDelay(entry.action, entry.fromStatus, entry.toStatus);
    const auditTimestamp = new Date(input.requestDate);
    auditTimestamp.setMinutes(auditTimestamp.getMinutes() + actionDelay);

    await prisma.auditLog.create({
      data: {
        billingRequestId: request.id,
        action: entry.action,
        actorId: entry.actor.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        // Backdate the audit log
        createdAt: auditTimestamp,
      },
    });
  }
}

function generateLineItemDescription(title: string, index: number, total: number): string {
  const prefixes = ['Core', 'Additional', 'Support', 'Documentation', 'Training', 'Consulting'];
  const suffixes = ['services', 'implementation', 'setup', 'configuration', 'development'];
  return `${prefixes[index % prefixes.length]} ${title.toLowerCase()} - ${suffixes[index % suffixes.length]}`;
}

function calculateActionDelay(action: AuditAction, fromStatus?: string, toStatus?: string): number {
  // Simulate realistic delays between actions (in minutes)
  const baseDelays: Record<AuditAction, number> = {
    [AuditAction.CREATED]: 0,
    [AuditAction.UPDATED]: 5,
    [AuditAction.SUBMITTED]: 240, // 4 hours for review
    [AuditAction.APPROVED]: 60,  // 1 hour for approval
    [AuditAction.REJECTED]: 60,  // 1 hour for rejection
    [AuditAction.RESUBMITTED]: 120, // 2 hours to resubmit
    [AuditAction.INVOICE_GENERATED]: 30, // 30 mins for invoice generation
    [AuditAction.INVOICE_PAID]: 1440, // 24 hours for payment (avg)
  };

  return baseDelays[action] || 10;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
