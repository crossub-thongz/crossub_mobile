export const INSPECTOR_LICENCE_TYPES = [
  'NSW Fair Trading — Property Inspection',
  'Other state licence',
  'No licence — trainee inspector',
] as const;

export const INSPECTOR_SERVICE_REGIONS = [
  'Sydney Metro',
  'Parramatta / Western Sydney',
  'North Shore',
  'Eastern Suburbs',
  'Northern Beaches',
  'Illawarra / South Coast',
  'Regional NSW',
] as const;

export const REGISTRATION_STATUS_LABEL = {
  not_started: 'Not registered',
  pending_review: 'Pending Inspection Dept review',
  approved: 'Approved',
  rejected: 'Rejected — resubmit required',
} as const;

export type RegistrationStatusKey = keyof typeof REGISTRATION_STATUS_LABEL;
