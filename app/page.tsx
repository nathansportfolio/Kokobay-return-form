import { CustomerReturnForm } from "@/components/CustomerReturnForm";

/** Public marketing-style page — prerender. */
export const dynamic = "force-static";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 pt-4 pb-[300px] sm:px-6 sm:pt-6 sm:pb-[300px]">
      <CustomerReturnForm />
    </div>
  );
}
