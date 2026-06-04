export function SitePageFooter() {
  return (
    <footer className="shrink-0 border-t border-zinc-200/90 bg-zinc-100 px-4 py-14 dark:border-zinc-800 dark:bg-zinc-900/40">
      <nav
        aria-label="Kokobay links"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center text-xs text-zinc-600 sm:text-sm dark:text-zinc-400"
      >
        <a
          href="https://www.kokobay.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded px-1 py-0.5 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          kokobay.co.uk
        </a>
        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <a
          href="https://www.kokobay.co.uk/pages/terms-conditions"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded px-1 py-0.5 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          Terms & conditions
        </a>
        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <a
          href="https://www.kokobay.co.uk/pages/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded px-1 py-0.5 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          Privacy policy
        </a>
      </nav>
    </footer>
  );
}
