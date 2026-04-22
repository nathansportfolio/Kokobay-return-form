import { randomUUID } from "node:crypto";
import type { Document } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import {
  CUSTOMER_FORM_REASONS,
  customerFormReasonLabel,
} from "@/lib/customerReturnFormReasons";

export const CUSTOMER_RETURN_FORMS_COLLECTION = "customerReturnForms";

export type CustomerReturnFormItem = {
  lineId: string;
  sku: string;
  title: string;
  quantity: number;
  reasonValue: string;
  reasonLabel: string;
};

/**
 * A submitted customer return form (online, before posting items back).
 */
export type CustomerReturnFormDoc = {
  submissionUid: string;
  orderRef: string;
  customerName: string;
  customerEmail: string;
  datePosted: string;
  items: CustomerReturnFormItem[];
  createdAt: Date;
};

type InsertInput = {
  orderRef: string;
  customerName: string;
  customerEmail: string;
  datePosted: string;
  items: {
    lineId: string;
    sku: string;
    title: string;
    quantity: number;
    reasonValue: string;
  }[];
};

const MAX = { name: 200, email: 256, orderRef: 100, itemTitle: 500 };

function clamp(s: string, n: number) {
  return String(s).trim().slice(0, n);
}

const ALLOWED_REASONS = new Set(
  CUSTOMER_FORM_REASONS.map((r) => r.value as string),
);

function isReasonAllowed(value: string): boolean {
  return ALLOWED_REASONS.has(value);
}

export function validateCustomerReturnForm(
  input: unknown,
):
  | { ok: true; data: InsertInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const o = input as Record<string, unknown>;
  const orderRef = clamp(String(o.orderRef ?? ""), MAX.orderRef);
  const customerName = clamp(String(o.customerName ?? ""), MAX.name);
  const customerEmail = clamp(String(o.customerEmail ?? ""), MAX.email);
  const datePosted = String(o.datePosted ?? "").trim();
  const itemsRaw = o.items;

  if (orderRef.length < 1) {
    return { ok: false, error: "Order number is required" };
  }
  if (customerName.length < 2) {
    return { ok: false, error: "Please enter your name" };
  }
  if (customerEmail.length < 3 || !customerEmail.includes("@")) {
    return { ok: false, error: "Please enter a valid email" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePosted)) {
    return { ok: false, error: "Please enter the date you posted the parcel (YYYY-MM-DD)" };
  }
  const t = new Date(datePosted);
  if (Number.isNaN(t.getTime())) {
    return { ok: false, error: "Invalid date posted" };
  }

  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return { ok: false, error: "Add at least one item you are returning" };
  }
  const items: InsertInput["items"] = [];
  for (const row of itemsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const lineId = clamp(String(r.lineId ?? ""), 200);
    const sku = clamp(String(r.sku ?? ""), 80);
    const title = clamp(String(r.title ?? ""), MAX.itemTitle);
    const q = Math.max(1, Math.min(999, Math.floor(Number(r.quantity) || 1)));
    const reasonValue = String(r.reasonValue ?? "").trim();
    if (!lineId || !sku || !isReasonAllowed(reasonValue)) {
      return { ok: false, error: "Each line needs a valid reason" };
    }
    items.push({
      lineId,
      sku,
      title: title || sku,
      quantity: q,
      reasonValue,
    });
  }
  if (items.length === 0) {
    return { ok: false, error: "No valid items" };
  }

  return {
    ok: true,
    data: {
      orderRef,
      customerName,
      customerEmail,
      datePosted,
      items,
    },
  };
}

export async function insertCustomerReturnForm(
  data: InsertInput,
): Promise<string> {
  const items: CustomerReturnFormItem[] = data.items.map((i) => ({
    lineId: i.lineId,
    sku: i.sku,
    title: i.title,
    quantity: i.quantity,
    reasonValue: i.reasonValue,
    reasonLabel: customerFormReasonLabel(i.reasonValue),
  }));
  const submissionUid = randomUUID();
  const doc: CustomerReturnFormDoc = {
    submissionUid,
    orderRef: data.orderRef,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    datePosted: data.datePosted,
    items,
    createdAt: new Date(),
  };
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(CUSTOMER_RETURN_FORMS_COLLECTION);
  await col.createIndex({ createdAt: -1 });
  await col.createIndex({ orderRef: 1, createdAt: -1 });
  await col.createIndex({ submissionUid: 1 }, { unique: true });
  await col.createIndex({ customerEmail: 1, createdAt: -1 });
  await col.insertOne(doc as unknown as Document);
  return submissionUid;
}
