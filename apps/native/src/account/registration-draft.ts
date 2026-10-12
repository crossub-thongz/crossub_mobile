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

const OWNER_KEY = 'csb_reg_draft_owner';

/** SecureStore rejects @ and other characters, so the email is folded into a safe key. */
function draftKey(email: string): string {
  const safe = email.trim().toLowerCase().replace(/[^A-Za-z0-9._-]/g, '_');
  return `csb_reg_${safe}`.slice(0, 200);
}

function persistedDraft(draft: RegistrationDraft): RegistrationDraft {
  return {
    mobile: draft.mobile,
    serviceRegions: draft.serviceRegions,
    tribunalQualified: draft.tribunalQualified,
    submittedStatus: draft.submittedStatus,
  };
}

export async function loadRegistrationDraft(email: string): Promise<RegistrationDraft | null> {
  try {
    const key = draftKey(email);
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegistrationDraft;
    const stored = persistedDraft(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(stored)) {
      await SecureStore.setItemAsync(key, JSON.stringify(stored));
    }
    return stored;
  } catch {
    return null;
  }
}

export async function saveRegistrationDraft(
  email: string,
  draft: RegistrationDraft,
): Promise<void> {
  const key = draftKey(email);
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(persistedDraft(draft)));
    await SecureStore.setItemAsync(OWNER_KEY, key);
    const legacy = `csb_reg_draft_${email.trim().toLowerCase()}`;
    if (legacy !== key) {
      await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
    }
  } catch {
    // Expo web / locked device: draft stays in memory on the form.
  }
}

export async function clearRegistrationDraft(email?: string | null): Promise<void> {
  const keys = new Set<string>([OWNER_KEY]);
  if (email) {
    keys.add(draftKey(email));
    keys.add(`csb_reg_draft_${email.trim().toLowerCase()}`);
  }
  try {
    const owner = await SecureStore.getItemAsync(OWNER_KEY);
    if (owner) keys.add(owner);
  } catch {
    // No owner key, or the store is locked.
  }
  await Promise.all(
    [...keys].map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)),
  );
}
