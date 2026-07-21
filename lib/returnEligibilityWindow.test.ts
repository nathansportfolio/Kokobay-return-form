import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DateTime } from "luxon";
import {
  estimatedReceiptLondonDate,
  isCustomerReturnWindowClosed,
} from "@/lib/returnEligibilityWindow";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

describe("returnEligibilityWindow", () => {
  it("uses delivered date when present", () => {
    const result = estimatedReceiptLondonDate({
      orderCreatedAt: "2026-07-01T10:00:00+01:00",
      deliveredAt: "2026-07-09T15:35:07+01:00",
      fulfilledAt: "2026-07-06T11:31:55+01:00",
      isInternational: false,
    });
    assert.ok(result);
    assert.equal(result.source, "delivered");
    assert.equal(result.receipt.toISODate(), "2026-07-09");
  });

  it("uses fulfilled + 3 days for UK when not delivered", () => {
    const result = estimatedReceiptLondonDate({
      orderCreatedAt: "2026-07-01T10:00:00+01:00",
      deliveredAt: null,
      fulfilledAt: "2026-07-06T11:31:55+01:00",
      isInternational: false,
    });
    assert.ok(result);
    assert.equal(result.source, "fulfilled_plus_transit");
    assert.equal(result.receipt.toISODate(), "2026-07-09");
  });

  it("uses fulfilled + 7 days for international when not delivered", () => {
    const result = estimatedReceiptLondonDate({
      orderCreatedAt: "2026-07-01T10:00:00+01:00",
      deliveredAt: null,
      fulfilledAt: "2026-07-06T11:31:55+01:00",
      isInternational: true,
    });
    assert.ok(result);
    assert.equal(result.source, "fulfilled_plus_transit");
    assert.equal(result.receipt.toISODate(), "2026-07-13");
  });

  it("closes window after 14 UK working days from delivered date", () => {
    // Delivered Thu 9 Jul 2026; +14 working days => Wed 29 Jul 2026 last allowed
    const deliveredAt = "2026-07-09T15:35:07+01:00";
    const stillOpen = DateTime.fromObject(
      { year: 2026, month: 7, day: 29 },
      { zone: WAREHOUSE_TZ },
    )
      .endOf("day")
      .toJSDate();
    const closed = DateTime.fromObject(
      { year: 2026, month: 7, day: 30 },
      { zone: WAREHOUSE_TZ },
    )
      .startOf("day")
      .toJSDate();

    assert.equal(
      isCustomerReturnWindowClosed(
        {
          orderCreatedAt: "2026-07-05T16:11:43+01:00",
          deliveredAt,
          fulfilledAt: "2026-07-06T11:31:55+01:00",
          isInternational: false,
        },
        stillOpen,
      ),
      false,
    );
    assert.equal(
      isCustomerReturnWindowClosed(
        {
          orderCreatedAt: "2026-07-05T16:11:43+01:00",
          deliveredAt,
          fulfilledAt: "2026-07-06T11:31:55+01:00",
          isInternational: false,
        },
        closed,
      ),
      true,
    );
  });
});
