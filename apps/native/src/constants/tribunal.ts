export const TRIBUNAL_TYPE_LABEL = {
  RENTAL_ARREARS: 'Rental Arrears',
  BOND_CLAIM: 'Bond Claim',
  PROPERTY_DAMAGE: 'Property Damage',
  LEASE_TERMINATION: 'Lease Termination',
  LEASE_BREACH: 'Lease Breach',
  MAINTENANCE_DISPUTE: 'Maintenance Dispute',
} as const;

export const TRIBUNAL_OUTCOME_LABEL = {
  claim_successful: 'Claim successful',
  partially_successful: 'Partially successful',
  rejected: 'Rejected',
  adjourned: 'Adjourned',
} as const;

export const TRIBUNAL_STATUS_LABEL = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  AWAITING_HEARING: 'Awaiting hearing',
  HEARING_SCHEDULED: 'Hearing scheduled',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
} as const;
