/** Row below the page heading: actions wrap left-to-right, full width. */
export const PICK_LIST_TOOLBAR_WRAP =
  "flex w-full min-w-0 flex-wrap items-center justify-start gap-1.5 sm:gap-2";

/**
 * One visual system: fixed height, no mixed underlines, matching borders.
 * @see PicklistHowToFindProductsButton
 */
export const PICK_LIST_TB_ACTION =
  "inline-flex h-9 min-h-9 max-h-9 shrink-0 select-none items-center justify-center gap-1 rounded-lg border px-3 text-sm font-medium leading-none no-underline shadow-sm transition-[background-color,box-shadow,border-color] dark:shadow-none";

export const PICK_LIST_TB_SECONDARY =
  "border-zinc-200/90 bg-zinc-50/95 text-foreground hover:border-zinc-300 hover:bg-zinc-100/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500/80 active:bg-zinc-200/50 dark:border-zinc-600 dark:bg-zinc-800/90 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/95 dark:active:bg-zinc-900/90";

/** Standard list — print action (sky, matches list CTAs) */
export const PICK_LIST_TB_PRINT_TODAY =
  "border-sky-400/60 bg-sky-50/95 font-semibold text-sky-950 shadow-sky-900/5 hover:border-sky-500/70 hover:bg-sky-100/90 active:bg-sky-100/80 dark:border-sky-500/50 dark:bg-sky-950/50 dark:text-sky-100 dark:shadow-sky-950/20 dark:hover:border-sky-400/50 dark:hover:bg-sky-900/70 dark:active:bg-sky-900/50";

/** UK Premium list — print action (amber) */
export const PICK_LIST_TB_PRINT_UK =
  "border-amber-400/70 bg-amber-50/95 font-semibold text-amber-950 shadow-amber-900/5 hover:border-amber-500/80 hover:bg-amber-100/90 active:bg-amber-100/80 dark:border-amber-600/60 dark:bg-amber-950/45 dark:text-amber-100 dark:shadow-amber-950/15 dark:hover:border-amber-500/50 dark:hover:bg-amber-900/60 dark:active:bg-amber-900/45";
