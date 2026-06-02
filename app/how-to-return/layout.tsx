/** Embedded in Shopify — block layout only; window scrolls, not nested containers. */
export default function HowToReturnLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="w-full">{children}</div>;
}
