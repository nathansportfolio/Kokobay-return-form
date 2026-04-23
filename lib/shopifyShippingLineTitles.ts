/**
 * Shipping line `title` values as returned by Shopify REST on orders. Used to
 * route NDD / premium picks (match is case- and extra-space–insensitive).
 * @see debug endpoint and shop logs for the live list.
 */
export const SHOPIFY_SHIPPING_LINE_TITLES = {
  expressInternational2to11: "Express International (2 to 11 business days)",
  expressInternationalFedEx: "Express international (FedEx 5-8 business days)",
  freeStandardOver100: "Free standard shipping (orders over £100)",
  standardInternational2to7: "Standard international 2-7 business days",
  starlinksHomeDelivery: "Starlinks Home Delivery",
  /** Next-day style — same calendar day, order before 2pm (London) for this list. */
  ukPremium1to2: "UK Premium Delivery (1-2 working days)",
  ukStandard3to5: "UK Standard Delivery (3-5 working days)",
} as const;

export const UK_PREMIUM_NDD_LINE_TITLE = SHOPIFY_SHIPPING_LINE_TITLES.ukPremium1to2;
