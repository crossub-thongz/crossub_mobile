import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchInspectorProfile,
  submitInspectorRegistration,
  type InspectorProfileDto,
  type InspectorRegistrationStatusDto,
  type SubmitInspectorRegistration,
} from '@/src/api/inspector';
import { useAuth } from '@/src/auth/auth-context';
import {
  normalizeInspectorAccessLevel,
  type InspectorAccessLevel,
} from '@/src/lib/inspector-access-level';
import {
  loadRegistrationDraft,
  saveRegistrationDraft,
  type RegistrationDraft,
} from '@/src/account/registration-draft';

type AccountContextValue = {
  profile: InspectorProfileDto | null;
  registration: InspectorRegistrationStatusDto | null;
  draft: RegistrationDraft | null;
  accessLevel: InspectorAccessLevel;
  tribunalQualified: boolean;
  registrationComplete: boolean;
  registrationResolved: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveRegistration: (body: SubmitInspectorRegistration) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

function isComplete(
  profile: InspectorProfileDto | null,
  draft: RegistrationDraft | null,
): boolean {
  if (profile?.roster) return true;
  const status = profile?.registration?.registrationStatus ?? draft?.submittedStatus;
  return status === 'approved' || status === 'pending_review';
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [profile, setProfile] = useState<InspectorProfileDto | null>(null);
  const [draft, setDraft] = useState<RegistrationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (status !== 'authed' || !user?.email) {
      setProfile(null);
      setDraft(null);
      setLoading(false);
      setResolved(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextDraft] = await Promise.all([
        fetchInspectorProfile(),
        loadRegistrationDraft(user.email),
      ]);
      setProfile(nextProfile);
      setDraft(nextDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
      setResolved(true);
    }
  }, [status, user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRegistration = useCallback(
    async (body: SubmitInspectorRegistration) => {
      if (!user?.email) throw new Error('Missing account email');
      const nextDraft: RegistrationDraft = {
        mobile: body.mobile,
        dateOfBirth: body.dateOfBirth,
        residentialAddress: body.residentialAddress,
        abn: body.abn,
        licenceNumber: body.licenceNumber,
        licenceType: body.licenceType,
        licenceExpiry: body.licenceExpiry,
        serviceRegions: body.serviceRegions,
        tribunalQualified: body.tribunalQualified,
        bankAccountName: body.bankAccountName,
        bankBsb: body.bankBsb,
        bankAccountNumber: body.bankAccountNumber,
      };
      await saveRegistrationDraft(user.email, nextDraft);
      setDraft(nextDraft);
      const serverReg = await submitInspectorRegistration(body);
      const confirmed: RegistrationDraft = {
        ...nextDraft,
        submittedStatus:
          serverReg.registrationStatus === 'approved' ? 'approved' : 'pending_review',
      };
      await saveRegistrationDraft(user.email, confirmed);
      setDraft(confirmed);
      setProfile((current) =>
        current
          ? { ...current, registration: serverReg }
          : {
              userId: user.id,
              email: user.email,
              firstName: user.firstName ?? null,
              lastName: user.lastName ?? null,
              phone: body.mobile ?? null,
              roster: null,
              registration: serverReg,
            },
      );
    },
    [user],
  );

  const registration = profile?.registration ?? null;
  const accessLevel = normalizeInspectorAccessLevel(profile?.roster?.accessLevel);
  const tribunalQualified = Boolean(
    registration?.tribunalQualified || profile?.roster?.tribunalQualified,
  );

  const value = useMemo(
    () => ({
      profile,
      registration,
      draft,
      accessLevel,
      tribunalQualified,
      registrationComplete: isComplete(profile, draft),
      registrationResolved: resolved,
      loading,
      error,
      refresh: load,
      saveRegistration,
    }),
    [
      profile,
      registration,
      draft,
      accessLevel,
      tribunalQualified,
      loading,
      error,
      load,
      saveRegistration,
      resolved,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
