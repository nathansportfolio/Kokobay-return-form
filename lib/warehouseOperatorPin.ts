import type { SiteAccessRole } from "@/lib/siteAccess";

export type WarehousePinMatch = {
  role: SiteAccessRole;
  /** Human-readable name for return logs / audit (e.g. Lana, KURT). */
  operatorLabel: string;
};

/**
 * PIN slots checked in order. First match wins.
 * Optional override: `NEXT_PUBLIC_SITE_PIN_<SLOT>_SIGNATURE` (same slot key as the PIN var).
 *
 * **Important:** each `NEXT_PUBLIC_*` value must be read with a **static** `process.env.FOO`
 * expression so Next.js inlines it into the client bundle. Dynamic `process.env[key]` does
 * not get substituted in the browser, so `/login` would never see your PINs.
 */
type PinSlot = {
  pin: string;
  signatureOverride: string;
  role: SiteAccessRole;
  defaultSignature: string;
};

function pinSlotsFromEnv(): PinSlot[] {
  return [
    {
      pin: String(process.env.NEXT_PUBLIC_SITE_PIN_ADMIN ?? "").trim(),
      signatureOverride: String(
        process.env.NEXT_PUBLIC_SITE_PIN_ADMIN_SIGNATURE ?? "",
      ).trim(),
      role: "admin",
      defaultSignature: "KURT",
    },
    {
      pin: String(process.env.NEXT_PUBLIC_SITE_PIN_USER ?? "").trim(),
      signatureOverride: String(
        process.env.NEXT_PUBLIC_SITE_PIN_USER_SIGNATURE ?? "",
      ).trim(),
      role: "user",
      defaultSignature: "ADMIN",
    },
    {
      pin: String(process.env.NEXT_PUBLIC_SITE_PIN_USER_1 ?? "").trim(),
      signatureOverride: String(
        process.env.NEXT_PUBLIC_SITE_PIN_USER_1_SIGNATURE ?? "",
      ).trim(),
      role: "user",
      defaultSignature: "Lana",
    },
    {
      pin: String(process.env.NEXT_PUBLIC_SITE_PIN_USER_2 ?? "").trim(),
      signatureOverride: String(
        process.env.NEXT_PUBLIC_SITE_PIN_USER_2_SIGNATURE ?? "",
      ).trim(),
      role: "user",
      defaultSignature: "Martha",
    },
    {
      pin: String(process.env.NEXT_PUBLIC_SITE_PIN_USER_3 ?? "").trim(),
      signatureOverride: String(
        process.env.NEXT_PUBLIC_SITE_PIN_USER_3_SIGNATURE ?? "",
      ).trim(),
      role: "user",
      defaultSignature: "Alice",
    },
    {
      pin: String(process.env.NEXT_PUBLIC_SITE_PIN_USER_4 ?? "").trim(),
      signatureOverride: String(
        process.env.NEXT_PUBLIC_SITE_PIN_USER_4_SIGNATURE ?? "",
      ).trim(),
      role: "user",
      defaultSignature: "Helen",
    },
  ];
}

/** Resolve entered PIN to session role + display name for return audit. */
export function matchWarehousePinToSession(
  enteredPin: string,
): WarehousePinMatch | null {
  const value = enteredPin.trim();
  if (!value) return null;
  for (const slot of pinSlotsFromEnv()) {
    if (slot.pin.length > 0 && value === slot.pin) {
      return {
        role: slot.role,
        operatorLabel:
          slot.signatureOverride.length > 0
            ? slot.signatureOverride
            : slot.defaultSignature,
      };
    }
  }
  return null;
}
