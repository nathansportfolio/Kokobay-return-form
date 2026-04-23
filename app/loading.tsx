export default function AppSegmentLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl flex-1 p-4 pb-10 sm:p-6"
      role="status"
      aria-label="Loading page"
    >
      <div className="animate-pulse">
        <div className="h-8 w-48 max-w-full rounded-md bg-zinc-200/90 dark:bg-zinc-800/80" />
        <div className="mt-3 h-4 w-full max-w-lg rounded bg-zinc-200/80 dark:bg-zinc-800/60" />
        <div className="mt-2 h-4 w-2/3 max-w-sm rounded bg-zinc-200/60 dark:bg-zinc-800/50" />
        <dl className="mt-6 flex flex-wrap gap-6">
          {["w-20", "w-16", "w-12"].map((w) => (
            <div key={w} className="space-y-2">
              <div
                className={`h-3.5 ${w} rounded bg-zinc-200/70 dark:bg-zinc-800/50`}
              />
              <div className="h-5 w-10 rounded bg-zinc-200/90 dark:bg-zinc-800/70" />
            </div>
          ))}
        </dl>
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 w-full rounded-xl border border-zinc-100/90 bg-zinc-100/40 dark:border-zinc-800/80 dark:bg-zinc-900/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
