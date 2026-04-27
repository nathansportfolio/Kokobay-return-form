type Props = {
  orderNumber: string;
  customerFirstName?: string;
  customerLastName?: string;
};

/**
 * Order ref + customer first/last when present (e.g. from Shopify).
 */
export function AssemblyOrderHeader({
  orderNumber,
  customerFirstName,
  customerLastName,
}: Props) {
  const f = customerFirstName?.trim() ?? "";
  const l = customerLastName?.trim() ?? "";
  const hasName = f.length > 0 || l.length > 0;

  return (
    <p className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 text-xs sm:text-sm">
      <span className="font-mono font-semibold text-foreground tabular-nums">
        {orderNumber}
      </span>
      {hasName ? (
        <>
          <span className="text-zinc-300 dark:text-zinc-500" aria-hidden>
            ·
          </span>
          <span className="min-w-0 font-medium text-foreground">
            {f}
            {f && l ? "\u00A0" : null}
            {l}
          </span>
        </>
      ) : null}
    </p>
  );
}
