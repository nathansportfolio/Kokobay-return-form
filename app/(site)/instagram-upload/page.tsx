import { Suspense } from "react";
import { InstagramUploadForm } from "@/components/InstagramUploadForm";

export const dynamic = "force-static";

export default function InstagramUploadPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8">
      <div className="w-full">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Share your Kokobay look
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Upload a photo of you wearing Kokobay, tell us which pieces you have on,
            and agree for us to feature you on our website or social channels.
          </p>
        </header>
        <Suspense fallback={null}>
          <InstagramUploadForm />
        </Suspense>
      </div>
    </div>
  );
}
