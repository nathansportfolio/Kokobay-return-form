import { CustomerReturnForm } from "@/components/CustomerReturnForm";

/** Public marketing-style page — prerender. */
export const dynamic = "force-static";

export default function CustomerReturnFormPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 p-4 pb-12 sm:p-6">
      <CustomerReturnForm />
    </div>
  );
}
