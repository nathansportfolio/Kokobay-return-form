import { SitePageFooter } from "@/components/SitePageFooter";

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span className="min-w-0 text-sm font-normal tracking-[0.18em] text-zinc-900 sm:text-base dark:text-zinc-100">
          KOKO BAY TRACKING
        </span>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <SitePageFooter />
    </>
  );
}
