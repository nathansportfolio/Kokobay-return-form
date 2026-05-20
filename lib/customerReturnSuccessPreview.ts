/** Query param for dev/preview of post-submit success screens (no form submission). */
export const CUSTOMER_RETURN_SUCCESS_PREVIEW_PARAM = "previewSuccess";

export type CustomerReturnSuccessPreview = {
  flow: "inpost" | "post";
  previewUid: string;
};

/**
 * `?previewSuccess=inpost` — UK InPost success screen
 * `?previewSuccess=post` — postal address success screen
 */
export function parseCustomerReturnSuccessPreview(
  searchParams: Pick<URLSearchParams, "get">,
): CustomerReturnSuccessPreview | null {
  const raw = searchParams
    .get(CUSTOMER_RETURN_SUCCESS_PREVIEW_PARAM)
    ?.trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "inpost" || raw === "uk") {
    return { flow: "inpost", previewUid: "PREVIEW-INPOST" };
  }
  if (raw === "post" || raw === "intl" || raw === "international") {
    return { flow: "post", previewUid: "PREVIEW-POST" };
  }
  return null;
}
