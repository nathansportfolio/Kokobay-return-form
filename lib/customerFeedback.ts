import clientPromise, { kokobayDbName } from "@/lib/mongodb";

export const CUSTOMER_FEEDBACK_COLLECTION = "customerFeedback";

export type CustomerFeedbackDoc = {
  rating: number;
  comment: string | null;
  createdAt: Date;
  userAgent: string | null;
};

const MAX_COMMENT = 2000;

export function validateCustomerFeedback(
  input: unknown,
):
  | { ok: true; data: { rating: number; comment: string | null } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const o = input as Record<string, unknown>;
  const ratingRaw =
    typeof o.rating === "number"
      ? o.rating
      : Number.parseInt(String(o.rating ?? ""), 10);
  if (
    !Number.isInteger(ratingRaw) ||
    ratingRaw < 1 ||
    ratingRaw > 5
  ) {
    return { ok: false, error: "Please choose a rating from 1 to 5 stars." };
  }

  const commentRaw =
    o.comment == null ? "" : String(o.comment).trim().slice(0, MAX_COMMENT);
  return {
    ok: true,
    data: {
      rating: ratingRaw,
      comment: commentRaw.length > 0 ? commentRaw : null,
    },
  };
}

export async function insertCustomerFeedback(input: {
  rating: number;
  comment: string | null;
  userAgent?: string | null;
}): Promise<{ ok: true }> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<CustomerFeedbackDoc>(CUSTOMER_FEEDBACK_COLLECTION);

  await col.insertOne({
    rating: input.rating,
    comment: input.comment,
    createdAt: new Date(),
    userAgent: input.userAgent?.trim().slice(0, 400) || null,
  });

  return { ok: true };
}
