"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  kokobayProxyInstagramSubmissionsApi,
  kokobayProxySearchApi,
} from "@/lib/kokobayApiRoutes";
import {
  kokobayProxyErrorMessage,
  readKokobayProxyJson,
} from "@/lib/kokobayProxyClient";
import type { StorefrontProductPreview, StorefrontSearchResponse } from "@/types/storefront";

type SelectedProduct = {
  productId: string;
  handle: string;
  title: string;
  imageUrl?: string;
};

type FormMeta = {
  consentVersion: string;
  consentText: string;
  maxProducts: number;
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500";

const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

const photoPreviewFrameClass =
  "relative aspect-[4/5] w-full max-w-[11rem] overflow-hidden rounded-2xl border border-zinc-200 sm:max-w-[13rem] dark:border-zinc-800";

const photoPreviewImageClass =
  "block h-full w-full object-cover object-center bg-zinc-100 dark:bg-zinc-900";

function ProductThumb({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}

export function InstagramUploadForm() {
  const [meta, setMeta] = useState<FormMeta | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [instagramPostUrl, setInstagramPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [consentGranted, setConsentGranted] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<StorefrontProductPreview[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedUid, setSubmittedUid] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(kokobayProxyInstagramSubmissionsApi(), {
          method: "GET",
          cache: "no-store",
        });
        const data = await readKokobayProxyJson<
          FormMeta & { ok?: boolean; error?: string }
        >(res, "Load form");
        if (!res.ok || !data.consentVersion) {
          throw new Error(kokobayProxyErrorMessage(data, "Could not load form"));
        }
        if (!cancelled) {
          setMeta({
            consentVersion: data.consentVersion,
            consentText: data.consentText,
            maxProducts: data.maxProducts,
          });
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Could not load submission form",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const maxProducts = meta?.maxProducts ?? 10;
  const canAddMoreProducts = selectedProducts.length < maxProducts;

  const searchProducts = useCallback(async () => {
    const q = productQuery.trim();
    if (q.length < 2) {
      toast.error("Type at least 2 characters to search products");
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        kokobayProxySearchApi({ q, first: "8", unavailable: "show" }),
      );
      const data = await readKokobayProxyJson<
        StorefrontSearchResponse & { error?: string }
      >(res, "Product search");
      if (!res.ok) {
        throw new Error(kokobayProxyErrorMessage(data, "Product search failed"));
      }
      setProductResults(data.products ?? []);
      if ((data.products ?? []).length === 0) {
        toast.message("No products found — try another search");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Product search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [productQuery]);

  const addProduct = useCallback(
    (product: StorefrontProductPreview) => {
      if (!canAddMoreProducts) {
        toast.error(`You can select up to ${maxProducts} products`);
        return;
      }
      setSelectedProducts((prev) => {
        if (prev.some((p) => p.productId === product.id)) return prev;
        return [
          ...prev,
          {
            productId: product.id,
            handle: product.handle,
            title: product.title,
            imageUrl: product.featuredImage?.url ?? undefined,
          },
        ];
      });
    },
    [canAddMoreProducts, maxProducts],
  );

  const removeProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const clearPhotoPreview = useCallback(() => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const submitDisabled = useMemo(() => {
    return (
      submitting ||
      !meta ||
      !name.trim() ||
      !email.trim() ||
      !imageFile ||
      selectedProducts.length === 0 ||
      !consentGranted
    );
  }, [
    consentGranted,
    email,
    imageFile,
    meta,
    name,
    selectedProducts.length,
    submitting,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meta || submitDisabled || !imageFile) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("image", imageFile);
      const uploadRes = await fetch(kokobayProxyInstagramSubmissionsApi("/upload"), {
        method: "POST",
        body: form,
      });
      const uploadData = await readKokobayProxyJson<{
        ok?: boolean;
        error?: string;
        imageUrl?: string;
        s3Key?: string;
      }>(uploadRes, "Image upload");
      if (!uploadRes.ok || !uploadData.imageUrl || !uploadData.s3Key) {
        throw new Error(kokobayProxyErrorMessage(uploadData, "Image upload failed"));
      }

      const submitRes = await fetch(kokobayProxyInstagramSubmissionsApi(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          instagramHandle: instagramHandle.trim() || undefined,
          instagramPostUrl: instagramPostUrl.trim() || undefined,
          caption: caption.trim() || undefined,
          uploadedImageUrl: uploadData.imageUrl,
          uploadedImageS3Key: uploadData.s3Key,
          products: selectedProducts,
          consentGranted: true,
          consentVersion: meta.consentVersion,
        }),
      });
      const submitData = await readKokobayProxyJson<{
        ok?: boolean;
        error?: string;
        submissionUid?: string;
      }>(submitRes, "Submit");
      if (!submitRes.ok || !submitData.submissionUid) {
        throw new Error(kokobayProxyErrorMessage(submitData, "Submission failed"));
      }

      setSubmittedUid(submitData.submissionUid);
      toast.success("Thank you — your outfit has been submitted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedUid) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold text-foreground">Thank you!</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          We have received your submission. If we feature your look, we may contact you
          at the email you provided.
        </p>
        <p className="mt-4 text-xs text-zinc-500">Reference: {submittedUid}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Your details</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tell us who you are so we can credit you if we share your look.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ig-upload-name">
              Name
            </label>
            <input
              id="ig-upload-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ig-upload-email">
              Email
            </label>
            <input
              id="ig-upload-email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ig-upload-handle">
              Instagram handle
            </label>
            <input
              id="ig-upload-handle"
              className={inputClass}
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              placeholder="@yourhandle"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ig-upload-post-url">
              Instagram post link <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              id="ig-upload-post-url"
              type="url"
              className={inputClass}
              value={instagramPostUrl}
              onChange={(e) => setInstagramPostUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/…"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Your photo</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            JPEG, PNG, WebP, or HEIC — up to 10 MB.
          </p>
        </div>
        {!imagePreviewUrl ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40">
            <UploadSimple size={28} className="text-zinc-500" aria-hidden />
            <span className="mt-2 text-sm font-medium text-foreground">
              Choose an image
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              required
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={photoPreviewFrameClass}>
              <button
                type="button"
                onClick={clearPhotoPreview}
                className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white/95 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur hover:bg-white dark:border-zinc-600 dark:bg-zinc-950/95 dark:hover:bg-zinc-950"
                aria-label="Remove uploaded photo"
              >
                <X size={12} aria-hidden />
                Remove
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Selected outfit preview"
                className={photoPreviewImageClass}
              />
            </div>
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="ig-upload-caption">
            Caption (optional)
          </label>
          <textarea
            id="ig-upload-caption"
            className={`${inputClass} min-h-24 resize-y`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Anything you'd like us to know about your look"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            What are you wearing?
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Search Kokobay products and add everything visible in your photo.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search products…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchProducts();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void searchProducts()}
            disabled={searchLoading}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <MagnifyingGlass size={18} aria-hidden />
            Search
          </button>
        </div>

        {productResults.length > 0 ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {productResults.map((product) => {
              const selected = selectedProducts.some((p) => p.productId === product.id);
              return (
                <li key={product.id} className="flex items-center gap-3 bg-white p-3 dark:bg-zinc-950">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                    {product.featuredImage?.url ? (
                      <ProductThumb src={product.featuredImage.url} />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {product.title}
                    </p>
                    {!product.availableForSale ? (
                      <p className="text-xs text-zinc-500">Sold out</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={selected || !canAddMoreProducts}
                    onClick={() => addProduct(product)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-zinc-700"
                  >
                    <Plus size={14} aria-hidden />
                    {selected ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {selectedProducts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Selected products</p>
            <ul className="space-y-2">
              {selectedProducts.map((product) => (
                <li
                  key={product.productId}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
                    {product.imageUrl ? (
                      <ProductThumb src={product.imageUrl} />
                    ) : null}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {product.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProduct(product.productId)}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-foreground dark:hover:bg-zinc-800"
                    aria-label={`Remove ${product.title}`}
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-zinc-300"
            checked={consentGranted}
            onChange={(e) => setConsentGranted(e.target.checked)}
            required
          />
          <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {meta?.consentText ??
              "I agree for Kokobay to use my content and confirm I am the owner (or have permission)."}
          </span>
        </label>
      </section>

      <button
        type="submit"
        disabled={submitDisabled}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-foreground px-6 py-3.5 text-sm font-medium text-background shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit your look"}
      </button>
    </form>
  );
}
