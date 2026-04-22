import type { Metadata } from "next";
import Link from "next/link";
import { CustomerReturnForm } from "@/components/CustomerReturnForm";

export const metadata: Metadata = {
  title: "Start a return",
  description:
    "Enter your order number, choose what you are sending back, then post to our address. We email you when the parcel arrives; refund within 5–10 working days.",
};

export default function CustomerReturnFormPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <p className="text-sm text-zinc-500">
        <Link
          className="font-medium text-foreground underline"
          href="/returns"
        >
          ← Staff returns
        </Link>{" "}
        ·{" "}
        <Link
          className="font-medium text-foreground underline"
          href="/"
        >
          Home
        </Link>
      </p>
      <div className="mt-4" />
      <CustomerReturnForm />
    </div>
  );
}
