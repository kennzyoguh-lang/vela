import { ValidationError } from "./errors";

// Canonicalizes to a consistent E.164-ish form (+234...) so the same
// physical number matches at login/lookup regardless of how it was typed
// in (leading 0, leading 234, spaces/dashes, or already-prefixed +234).
// Nigeria-only for now, matching the rest of this codebase's country scope
// (Organisation.country defaults to "NG", PAYE/pension are Nigeria-specific).
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  let normalized: string;
  if (digits.startsWith("+")) normalized = digits;
  else if (digits.startsWith("0")) normalized = `+234${digits.slice(1)}`;
  else if (digits.startsWith("234")) normalized = `+${digits}`;
  else normalized = `+234${digits}`;

  if (!/^\+234\d{10}$/.test(normalized)) {
    throw new ValidationError("Enter a valid Nigerian phone number", "phone");
  }
  return normalized;
}
