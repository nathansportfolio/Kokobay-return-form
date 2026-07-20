"use client";

import { useState } from "react";

export function AffiliateLogin({
  onSubmit,
}: {
  onSubmit: (code: string, pin: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-xl tracking-[0.18em] text-[#1A1A1A]">
          KOKO BAY
        </p>
        <p className="mt-2 text-center text-sm text-[#7A746C]">Affiliate portal</p>

        <form
          className="mt-10 space-y-4 rounded-2xl border border-[#EBE6E0] bg-white p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)]"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setBusy(true);
              setError(null);
              const err = await onSubmit(code, pin);
              setBusy(false);
              if (err) setError(err);
            })();
          }}
        >
          <div>
            <label
              htmlFor="affiliate-code"
              className="text-sm font-medium text-[#3D3A36]"
            >
              Code
            </label>
            <input
              id="affiliate-code"
              name="code"
              autoComplete="username"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-3 text-sm text-[#1A1A1A] outline-none ring-[#E89292]/40 placeholder:text-[#A39E97] focus:border-[#E89292] focus:ring-2"
              placeholder="Your affiliate code"
            />
          </div>
          <div>
            <label
              htmlFor="affiliate-pin"
              className="text-sm font-medium text-[#3D3A36]"
            >
              PIN
            </label>
            <input
              id="affiliate-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoComplete="current-password"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className="mt-1.5 w-full rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-3 text-sm tracking-[0.35em] text-[#1A1A1A] outline-none ring-[#E89292]/40 placeholder:tracking-normal placeholder:text-[#A39E97] focus:border-[#E89292] focus:ring-2"
              placeholder="4–8 digit PIN"
            />
          </div>
          {error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
