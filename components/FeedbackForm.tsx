"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Star } from "@phosphor-icons/react";

function parseInitialRating(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export function FeedbackForm() {
  const searchParams = useSearchParams();
  const initialFromUrl = useMemo(
    () => parseInitialRating(searchParams.get("rating")),
    [searchParams],
  );

  const [rating, setRating] = useState<number | null>(initialFromUrl);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (initialFromUrl != null) setRating(initialFromUrl);
  }, [initialFromUrl]);

  const display = hover ?? rating;

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-[#EBE6E0] bg-white p-6 text-center shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] sm:p-8">
        <p className="text-xl tracking-[0.18em] text-[#1A1A1A]">KOKO BAY</p>
        <h1 className="mt-8 text-2xl font-medium tracking-tight text-[#1A1A1A]">
          Thank you for your feedback
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#7A746C]">
          We really appreciate you taking the time to tell us how we did.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-center text-xl tracking-[0.18em] text-[#1A1A1A]">
        KOKO BAY
      </p>
      <p className="mt-2 text-center text-sm text-[#7A746C]">How was your return?</p>

      <form
        className="mt-10 space-y-6 rounded-2xl border border-[#EBE6E0] bg-white p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setError(null);
            if (rating == null) {
              setError("Please choose a star rating.");
              return;
            }
            setBusy(true);
            try {
              const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  rating,
                  comment: comment.trim() || undefined,
                }),
              });
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
              };
              if (!res.ok || data.ok === false) {
                setError(data.error ?? "Something went wrong. Please try again.");
                return;
              }
              setDone(true);
            } catch {
              setError("Could not send feedback. Please try again.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <div>
          <p className="text-sm font-medium text-[#3D3A36]">Your rating</p>
          <div
            className="mt-3 flex items-center justify-center gap-1.5 sm:gap-2"
            role="radiogroup"
            aria-label="Star rating"
            onMouseLeave={() => setHover(null)}
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = display != null && value <= display;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(null)}
                  onClick={() => setRating(value)}
                  className="rounded-lg p-1.5 text-[#E4DED6] transition-colors hover:text-[#E89292] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E89292]/40"
                >
                  <Star
                    className={`h-9 w-9 sm:h-10 sm:w-10 ${
                      filled ? "text-[#E89292]" : "text-[#E4DED6]"
                    }`}
                    weight={filled ? "fill" : "regular"}
                  />
                </button>
              );
            })}
          </div>
          {rating != null ? (
            <p className="mt-2 text-center text-xs tabular-nums text-[#8A8580]">
              {rating} / 5
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="feedback-comment"
            className="text-sm font-medium text-[#3D3A36]"
          >
            Comments{" "}
            <span className="font-normal text-[#8A8580]">(optional)</span>
          </label>
          <textarea
            id="feedback-comment"
            name="comment"
            rows={4}
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-3 text-sm text-[#1A1A1A] outline-none ring-[#E89292]/40 placeholder:text-[#A39E97] focus:border-[#E89292] focus:ring-2"
            placeholder="Tell us anything that would help…"
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
          {busy ? "Sending…" : "Submit feedback"}
        </button>
      </form>
    </div>
  );
}
