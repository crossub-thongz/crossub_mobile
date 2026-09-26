import { INSPECTOR_HOURLY_RATE_AUD } from '@/constants/inspection-rates';
import { buildJobPayFields } from '@/lib/build-job-pay';
import { calculateLaborFee, calculateFuelAllowance } from '@/lib/inspector-pay';
import type {
  EarningsRecord,
  InspectionJob,
  InspectionType,
  InspectorNotification,
  InspectorProfile,
  InspectorRegistration,
  KeyAccess,
  MessageThread,
  PropertyInspectionSpec,
  ServiceRegionKey,
  ThreadMessage,
  TribunalHearing,
} from '@/lib/types';

const earn = (
  id: string,
  jobId: string,
  type: InspectionType,
  propertyAddress: string,
  completedAt: string,
  hoursWorked: number,
  travelKmOneWay: number,
): EarningsRecord => {
  const laborAmount = calculateLaborFee(hoursWorked);
  const fuelAllowance = calculateFuelAllowance(travelKmOneWay);
  return {
    id,
    jobId,
    type,
    propertyAddress,
    completedAt,
    hoursWorked,
    hourlyRate: INSPECTOR_HOURLY_RATE_AUD,
    travelKmOneWay,
    fuelAllowance,
    laborAmount,
    amount: Math.round((laborAmount + fuelAllowance) * 100) / 100,
    accountingSynced: true,
  };
};

const pay = (
  property: PropertyInspectionSpec,
  region: ServiceRegionKey,
  km: number,
  type: InspectionType,
) => buildJobPayFields(property, region, km, type);

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 5);
const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 3);

const iso = (d: Date, hour = 10, minute = 0) => {
  const copy = new Date(d);
  copy.setHours(hour, minute, 0, 0);
  return copy.toISOString();
};

const LOCKBOX_ACCESS: KeyAccess = {
  method: 'lockbox',
  code: '4821',
  location: 'Lockbox on front gate — left pillar',
  collectSteps: [
    'Enter code and open lockbox',
    'Take keys and snap a photo of keys in hand',
    'Close lockbox securely',
  ],
  returnSteps: [
    'Return keys to lockbox after inspection',
    'Snap photo of keys inside lockbox',
    'Scramble lockbox code',
  ],
  photoRequired: true,
};

export const DEMO_INSPECTOR_REGISTRATION: InspectorRegistration = {
  firstName: 'Alex',
  lastName: 'Chen',
  email: 'alex.chen@crossub.com.au',
  mobile: '0412 345 678',
  dateOfBirth: '1988-04-12',
  residentialAddress: '42 Inspection Ave, Rhodes NSW 2138',
  abn: '12 345 678 901',
  licenceNumber: 'NSW-PI-88421',
  licenceType: 'NSW Fair Trading — Property Inspection',
  licenceExpiry: '2027-06-30',
  serviceRegions: ['Sydney Metro', 'Parramatta / Western Sydney', 'North Shore'],
  tribunalQualified: true,
  bankAccountName: 'Alex Chen',
  bankBsb: '062-000',
  bankAccountNumber: '12345678',
  registrationStatus: 'approved',
  submittedAt: '2025-11-01T09:00:00.000Z',
  reviewedAt: '2025-11-03T14:00:00.000Z',
};

export const INSPECTOR_PROFILE: InspectorProfile = {
  id: 'insp-001',
  name: 'Alex Chen',
  email: 'alex.chen@crossub.com.au',
  phone: '0412 345 678',
  tribunalQualified: true,
  accessLevel: 5,
  weeklyEarnings: 0,
  rating: 4.9,
  totalCompleted: 42,
  lateArrivals: 1,
  registration: null,
  registrationComplete: false,
};

export const JOBS: InspectionJob[] = [
  {
    id: 'job-001',
    type: 'open',
    propertyAddress: '12 Harbour View Rd, Pyrmont NSW 2009',
    suburb: 'Pyrmont',
    latitude: -33.8688,
    longitude: 151.1957,
    scheduledDate: iso(today, 9, 30),
    scheduledTime: iso(today, 9, 30),
    priority: 'urgent',
    distanceKm: 4.2,
    status: 'accepted',
    source: 'assigned',
    assignedBy: 'Sarah Mitchell',
    agentName: 'Sarah Mitchell',
    agentCompany: 'Harbour Property Group',
    agentEmail: 'sarah.mitchell@harbourproperty.com.au',
    agentPhone: '0412 998 441',
    keyAccess: LOCKBOX_ACCESS,
    ...pay(
      { propertyKind: 'apartment', bedrooms: 2, bathrooms: 2 },
      'cbd_inner',
      4.2,
      'open',
    ),
    workflowStep: 1,
  },
  {
    id: 'job-002',
    type: 'ingoing',
    propertyAddress: '45 George St, Parramatta NSW 2150',
    suburb: 'Parramatta',
    latitude: -33.815,
    longitude: 151.001,
    scheduledDate: iso(today, 14, 0),
    scheduledTime: iso(today, 14, 0),
    priority: 'normal',
    distanceKm: 18.5,
    status: 'assigned',
    source: 'assigned',
    assignedBy: 'James Wu',
    tenantName: 'Emma Thompson',
    tenantPhone: '0423 111 222',
    tenantEmail: 'emma.thompson@email.com',
    agentName: 'James Wu',
    agentCompany: 'Western Sydney Realty',
    agentEmail: 'james.wu@westernsydneyrealty.com.au',
    agentPhone: '0433 221 009',
    keyAccess: {
      method: 'office',
      location: 'Western Sydney Realty — 45 George St foyer',
      collectSteps: [
        'Sign in at reception desk',
        'Collect keys from leasing officer',
      ],
      returnSteps: [
        'Return keys to reception before 5pm',
        'Confirm return on the sign-out sheet',
      ],
      photoRequired: true,
    },
    ...pay(
      { propertyKind: 'apartment', bedrooms: 3, bathrooms: 2 },
      'western_sydney',
      18.5,
      'ingoing',
    ),
  },
  {
    id: 'job-003',
    type: 'routine',
    propertyAddress: '8 Rose Lane, Chatswood NSW 2067',
    suburb: 'Chatswood',
    latitude: -33.796,
    longitude: 151.183,
    scheduledDate: iso(tomorrow, 11, 0),
    scheduledTime: iso(tomorrow, 11, 0),
    priority: 'normal',
    distanceKm: 12.1,
    status: 'accepted',
    source: 'pool',
    tenantName: 'Michael Park',
    agentName: 'Lisa Tran',
    agentCompany: 'North Shore Leasing',
    agentEmail: 'lisa.tran@northshoreleasing.com.au',
    agentPhone: '0401 555 882',
    ...pay(
      { propertyKind: 'apartment', bedrooms: 2, bathrooms: 2 },
      'northern_sydney',
      12.1,
      'routine',
    ),
  },
  {
    id: 'job-004',
    type: 'outgoing',
    propertyAddress: '22 Bondi Rd, Bondi NSW 2026',
    suburb: 'Bondi',
    latitude: -33.891,
    longitude: 151.259,
    scheduledDate: iso(tomorrow, 15, 30),
    scheduledTime: iso(tomorrow, 15, 30),
    priority: 'urgent',
    distanceKm: 9.8,
    status: 'available',
    source: 'pool',
    agentName: 'Tom Bradley',
    agentCompany: 'Eastern Beaches Realty',
    agentEmail: 'tom.bradley@easternbeaches.com.au',
    agentPhone: '0422 334 118',
    keyAccess: {
      method: 'agent',
      location: 'Meet agent on-site at 3:15pm',
      collectSteps: [
        'Call agent on arrival',
        'Collect keys from agent at property',
      ],
      returnSteps: [
        'Hand keys back to agent after inspection',
        'Snap photo of keys returned',
      ],
      photoRequired: true,
    },
    ...pay(
      {
        propertyKind: 'house',
        bedrooms: 3,
        bathrooms: 2,
        livingAreas: 1,
        kitchens: 1,
        laundries: 1,
        hasYard: true,
      },
      'eastern_suburbs',
      9.8,
      'outgoing',
    ),
  },
  {
    id: 'job-005',
    type: 'open',
    propertyAddress: '3 Market St, Sydney NSW 2000',
    suburb: 'Sydney CBD',
    latitude: -33.87,
    longitude: 151.206,
    scheduledDate: iso(nextWeek, 10, 0),
    scheduledTime: iso(nextWeek, 10, 0),
    priority: 'normal',
    distanceKm: 2.1,
    status: 'available',
    source: 'pool',
    ...pay(
      { propertyKind: 'apartment', bedrooms: 1, bathrooms: 1 },
      'cbd_inner',
      2.1,
      'open',
    ),
  },
  {
    id: 'job-006',
    type: 'routine',
    propertyAddress: '17 Pacific Hwy, St Leonards NSW 2065',
    suburb: 'St Leonards',
    latitude: -33.823,
    longitude: 151.195,
    scheduledDate: iso(lastWeek, 10, 0),
    scheduledTime: iso(lastWeek, 10, 0),
    priority: 'normal',
    distanceKm: 8.4,
    status: 'completed',
    source: 'assigned',
    assignedBy: 'Sarah Mitchell',
    ...pay(
      { propertyKind: 'apartment', bedrooms: 2, bathrooms: 2 },
      'northern_sydney',
      8.4,
      'routine',
    ),
    workflowStep: 99,
  },
  {
    id: 'job-007',
    type: 'ingoing',
    propertyAddress: '99 Victoria Ave, Chatswood NSW 2067',
    suburb: 'Chatswood',
    latitude: -33.797,
    longitude: 151.18,
    scheduledDate: iso(lastWeek, 13, 0),
    scheduledTime: iso(lastWeek, 13, 0),
    priority: 'normal',
    distanceKm: 11.2,
    status: 'completed',
    source: 'pool',
    ...pay(
      { propertyKind: 'apartment', bedrooms: 4, bathrooms: 3 },
      'northern_sydney',
      11.2,
      'ingoing',
    ),
    workflowStep: 99,
  },
];

export const TRIBUNALS: TribunalHearing[] = [
  {
    id: 'trib-001',
    jobId: 'job-trib-001',
    hearingDate: iso(nextWeek, 9, 0),
    hearingTime: iso(nextWeek, 9, 0),
    tribunalType: 'NCAT — Rental Bond',
    location: 'NCAT Sydney, 255 Elizabeth St',
    propertyAddress: '5/88 Crown St, Surry Hills NSW 2010',
    caseSummary: 'Bond claim for cleaning and minor damage at end of lease.',
    rentalArrears: 0,
    bondClaimAmount: 1850,
    propertyDamage: 'Carpet stain (living room), wall scuff (bedroom 2)',
    checklist: {
      evidenceComplete: true,
      hearingConfirmed: true,
      documentsDownloaded: false,
      attendanceConfirmed: false,
    },
    packageDocuments: [
      { name: 'Lease Agreement.pdf', url: '#' },
      { name: 'Entry Inspection Report.pdf', url: '#' },
      { name: 'Final Inspection Report.pdf', url: '#' },
      { name: 'Tenant Ledger.pdf', url: '#' },
      { name: 'Tribunal Application.pdf', url: '#' },
    ],
    status: 'upcoming',
  },
];

export const EARNINGS: EarningsRecord[] = [
  earn(
    'earn-001',
    'job-006',
    'routine',
    '17 Pacific Hwy, St Leonards NSW 2065',
    iso(lastWeek, 11, 30),
    1.5,
    8.4,
  ),
  earn(
    'earn-002',
    'job-007',
    'ingoing',
    '99 Victoria Ave, Chatswood NSW 2067',
    iso(lastWeek, 15, 0),
    2.5,
    11.2,
  ),
  {
    ...earn(
      'earn-003',
      'job-prev-001',
      'open',
      '14 King St, Newtown NSW 2042',
      iso(new Date(today.getTime() - 5 * 86400000), 12, 0),
      1,
      5.5,
    ),
    accountingSynced: false,
  },
];

export const MESSAGE_THREADS: MessageThread[] = [
  {
    id: 'msg-001',
    subject: 'Open inspection — 12 Harbour View Rd',
    participants: ['Sarah Mitchell', 'Alex Chen'],
    lastMessage: 'Tenant confirmed for 9:30am. Keys in lockbox 4821.',
    lastAt: iso(today, 8, 15),
    unread: 1,
    category: 'agent',
  },
  {
    id: 'msg-002',
    subject: 'Tribunal package — Surry Hills',
    participants: ['Leasing Team', 'Alex Chen'],
    lastMessage: 'Updated tenant ledger attached for NCAT hearing.',
    lastAt: iso(today, 7, 0),
    unread: 0,
    category: 'leasing',
  },
];

export const THREAD_MESSAGES: Record<string, ThreadMessage[]> = {
  'msg-001': [
    {
      id: 'tm-001',
      from: 'Sarah Mitchell',
      body: 'Hi Alex, open inspection today at Harbour View. Please confirm arrival.',
      at: iso(today, 7, 45),
    },
    {
      id: 'tm-002',
      from: 'Alex Chen',
      body: 'Confirmed — leaving now, ETA 9:20.',
      at: iso(today, 8, 0),
    },
    {
      id: 'tm-003',
      from: 'Sarah Mitchell',
      body: 'Tenant confirmed for 9:30am. Keys in lockbox 4821.',
      at: iso(today, 8, 15),
    },
  ],
  'msg-002': [
    {
      id: 'tm-004',
      from: 'Leasing Team',
      body: 'Tribunal package ready. Please review bond claim evidence before Friday.',
      at: iso(new Date(today.getTime() - 86400000), 16, 0),
    },
    {
      id: 'tm-005',
      from: 'Leasing Team',
      body: 'Updated tenant ledger attached for NCAT hearing.',
      at: iso(today, 7, 0),
      attachments: [{ name: 'Tenant_Ledger_Surry_Hills.pdf', url: '#' }],
    },
  ],
};

export const NOTIFICATIONS: InspectorNotification[] = [
  {
    id: 'notif-001',
    type: 'job_assigned',
    title: 'New assignment',
    body: 'Entry inspection assigned — 45 George St, Parramatta',
    href: '/jobs/job-002',
    read: false,
    createdAt: iso(today, 6, 30),
  },
  {
    id: 'notif-002',
    type: 'tribunal',
    title: 'Tribunal hearing scheduled',
    body: 'NCAT Sydney — 5/88 Crown St, Surry Hills',
    href: '/tribunal/trib-001',
    read: false,
    createdAt: iso(today, 7, 0),
  },
  {
    id: 'notif-003',
    type: 'job_available',
    title: 'Job available in pool',
    body: 'Final inspection — 22 Bondi Rd, Bondi (urgent)',
    href: '/job-pool',
    read: true,
    createdAt: iso(new Date(today.getTime() - 3600000), 5, 0),
  },
];
