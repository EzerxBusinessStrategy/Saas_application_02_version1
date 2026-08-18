export type AgreementAccessStatus = "active" | "expired";

export function isAgreementExpired(
  category: string,
  validUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (category !== "agreement" || !validUntil) {
    return false;
  }

  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }

  return expiry.getTime() <= now.getTime();
}

export function agreementAccessStatus(
  category: string,
  validUntil: string | null | undefined,
  now: Date = new Date(),
): AgreementAccessStatus | null {
  if (category !== "agreement") {
    return null;
  }

  return isAgreementExpired(category, validUntil, now) ? "expired" : "active";
}

export const AGREEMENT_EXPIRED_MESSAGE =
  "This agreement has expired. Contact your tenant administrator for a renewed copy.";
