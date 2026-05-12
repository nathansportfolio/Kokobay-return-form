import type { SiteAccessRole } from "@/lib/siteAccess";

export type WarehousePinMatch = {
  role: SiteAccessRole;
  /** Human-readable name for return logs / audit (e.g. Lana, KURT). */
  operatorLabel: string;
};

/**
 * PIN env slots checked in order. First match wins.
 * Optional override: `NEXT_PUBLIC_SITE_PIN_<SLOT>_SIGNATURE` (same slot key as the PIN var).
 */
const PIN_SLOTS: ReadonlyArray<{
  envPin: string;
  envSignature: string;
  role: SiteAccessRole;
  defaultSignature: string;
}> = [
  {
    envPin: "NEXT_PUBLIC_SITE_PIN_ADMIN",
    envSignature: "NEXT_PUBLIC_SITE_PIN_ADMIN_SIGNATURE",
    role: "admin",
    defaultSignature: "KURT",
  },
  {
    envPin: "NEXT_PUBLIC_SITE_PIN_USER",
    envSignature: "NEXT_PUBLIC_SITE_PIN_USER_SIGNATURE",
    role: "user",
    defaultSignature: "ADMIN",
  },
  {
    envPin: "NEXT_PUBLIC_SITE_PIN_USER_1",
    envSignature: "NEXT_PUBLIC_SITE_PIN_USER_1_SIGNATURE",
    role: "user",
    defaultSignature: "Lana",
  },
  {
    envPin: "NEXT_PUBLIC_SITE_PIN_USER_2",
    envSignature: "NEXT_PUBLIC_SITE_PIN_USER_2_SIGNATURE",
    role: "user",
    defaultSignature: "Martha",
  },
  {
    envPin: "NEXT_PUBLIC_SITE_PIN_USER_3",
    envSignature: "NEXT_PUBLIC_SITE_PIN_USER_3_SIGNATURE",
    role: "user",
    defaultSignature: "Alice",
  },
  {
    envPin: "NEXT_PUBLIC_SITE_PIN_USER_4",
    envSignature: "NEXT_PUBLIC_SITE_PIN_USER_4_SIGNATURE",
    role: "user",
    defaultSignature: "Helen",
  },
];

function readPublicEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function signatureForSlot(
  envPin: string,
  envSignature: string,
  defaultSignature: string,
): string {
  const override = readPublicEnv(envSignature);
  if (override) return override;
  return defaultSignature;
}

/** Resolve entered PIN to session role + display name for return audit. */
export function matchWarehousePinToSession(
  enteredPin: string,
): WarehousePinMatch | null {
  const value = enteredPin.trim();
  if (!value) return null;
  for (const slot of PIN_SLOTS) {
    const pin = readPublicEnv(slot.envPin);
    if (pin.length > 0 && value === pin) {
      return {
        role: slot.role,
        operatorLabel: signatureForSlot(
          slot.envPin,
          slot.envSignature,
          slot.defaultSignature,
        ),
      };
    }
  }
  return null;
}
