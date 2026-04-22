import type { Order, ShopifyOrder } from "@/types/shopify";

export function mapShopifyOrder(o: ShopifyOrder): Order {
  return {
    id: o.id,
    shopifyOrderId: String(o.id),
    orderNumber: o.order_number,
    customerName:
      `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim(),
    email: o.email,
    total: Number(o.total_price),
    createdAt: o.created_at,
    items: o.line_items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  };
}
