import { redirect } from "next/navigation";

// Old path; use /orders/today. Kept for bookmarks.
export default function OrdersShopifyRedirect() {
  redirect("/orders/today");
}
