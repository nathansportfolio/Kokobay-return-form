export type TrackOrderSuccessResponse = {
  ok: true;
  orderNumber: string;
  status: string;
  onItsWay: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type TrackOrderErrorResponse = {
  ok: false;
  error: string;
  code: "invalid_input" | "not_found" | "not_configured" | "rate_limited" | "failed";
};

export type TrackOrderApiResponse = TrackOrderSuccessResponse | TrackOrderErrorResponse;
