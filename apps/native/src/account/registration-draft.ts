import * as SecureStore from 'expo-secure-store';

export type RegistrationDraft = {
  mobile?: string;
  dateOfBirth?: string;
  residentialAddress?: string;
  abn?: string;
  licenceNumber?: string;
  licenceType?: string;
  licenceExpiry?: string;
  serviceRegions?: string[];
  tribunalQualified?: boolean;
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  submittedStatus?: 'pending_review' | 'approved';
};

function keyFor(email: string): string {
  return `csb_reg_draft_${email.trim().toLowerCase()}`;
}

export async function loadRegistrationDraft(email: string): Promise<RegistrationDraft | null> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(email));
    if (!raw) return null;
    return JSON.parse(raw) as RegistrationDraft;
  } catch {
    return null;
  }
}

export async function saveRegistrationDraft(
  email: string,
  draft: RegistrationDraft,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyFor(email), JSON.stringify(draft));
  } catch {
    // Expo web / locked device: draft stays in memory on the form.
  }
}
