/**
 * Saves an in-progress registration form so a visitor who leaves the page can
 * resume where they left off (as long as their seat hold is still alive).
 */
const DRAFT_KEY = "ltrvc_registration_draft";

export interface RegistrationDraftSigned {
  /** id of the saved CMSP Student Registration Form record */
  regFormId?: string;
  /** id of the saved model release record */
  modelReleaseId?: string;
  /** id of the saved signed waiver record */
  waiverId?: string;
  /** true when the minor's guardian will sign in person at class */
  guardianInPerson?: boolean;
}

export interface RegistrationDraft {
  scheduleId: string;
  course: string;
  location: string;
  savedAt: string;
  values: Record<string, unknown>;
  /** Forms the visitor already signed, so we can skip them on resume. */
  signed?: RegistrationDraftSigned;
}

export const saveRegistrationDraft = (draft: RegistrationDraft) => {
  try {
    // Never let an autosave of the form fields wipe out already-signed forms.
    const existing = readRegistrationDraft();
    const signed =
      draft.signed ?? (existing && existing.scheduleId === draft.scheduleId ? existing.signed : undefined);
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, signed }));
  } catch {
    /* ignore */
  }
};

export const readRegistrationDraft = (): RegistrationDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegistrationDraft;
    if (!parsed?.values || typeof parsed.values !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

/** Merge signed-form info into the current draft (keeps the typed field values). */
export const saveDraftSignedStep = (scheduleId: string, patch: RegistrationDraftSigned) => {
  const existing = readRegistrationDraft();
  if (!existing || existing.scheduleId !== scheduleId) return;
  saveRegistrationDraft({
    ...existing,
    savedAt: new Date().toISOString(),
    signed: { ...(existing.signed || {}), ...patch },
  });
};

export const clearRegistrationDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
};

/** True when the draft actually contains something worth restoring. */
export const draftHasContent = (draft: RegistrationDraft | null): boolean => {
  if (!draft) return false;
  const signed = draft.signed || {};
  if (signed.regFormId || signed.modelReleaseId || signed.waiverId) return true;
  const meaningful = ["firstName", "lastName", "email", "phone", "address", "licenseNumber", "dateOfBirth"];
  return meaningful.some((k) => {
    const v = draft.values[k];
    return typeof v === "string" && v.trim() !== "";
  });
};
