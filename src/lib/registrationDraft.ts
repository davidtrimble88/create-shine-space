/**
 * Saves an in-progress registration form so a visitor who leaves the page can
 * resume where they left off (as long as their seat hold is still alive).
 */
const DRAFT_KEY = "ltrvc_registration_draft";

export interface RegistrationDraft {
  scheduleId: string;
  course: string;
  location: string;
  savedAt: string;
  values: Record<string, unknown>;
}

export const saveRegistrationDraft = (draft: RegistrationDraft) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
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
  const meaningful = ["firstName", "lastName", "email", "phone", "address", "licenseNumber", "dateOfBirth"];
  return meaningful.some((k) => {
    const v = draft.values[k];
    return typeof v === "string" && v.trim() !== "";
  });
};
