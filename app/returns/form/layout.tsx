import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "KOKO BAY RETURNS" },
  description:
    "Enter your order number, choose what you are sending back, then post to our address. We email you when the parcel arrives; refund within 5–10 working days.",
};

export default function CustomerReturnFormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
