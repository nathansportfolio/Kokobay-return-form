/**
 * True when Shopify REST `shipping_address.country` is United Kingdom (UK orders
 * use InPost returns instead of posting to the warehouse address).
 */
export function isUnitedKingdomShippingCountry(
  country: string | null | undefined,
  countryCode?: string | null | undefined,
): boolean {
  const code = String(countryCode ?? "")
    .trim()
    .toUpperCase();
  if (code === "GB") return true;
  const c = String(country ?? "")
    .trim()
    .toLowerCase();
  return c === "united kingdom";
}
