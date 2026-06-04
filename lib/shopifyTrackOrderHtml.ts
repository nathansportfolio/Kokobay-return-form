import {
  TRACK_ORDER_API_BASE_URL,
  TRACK_ORDER_PAGE_COPY,
} from "./trackOrderPageContent";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap");

.kb-track-page {
  --kb-text: #18181b;
  --kb-muted: #52525b;
  --kb-border: #e4e4e7;
  --kb-card-shadow: 0 4px 28px -6px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  max-width: 42rem;
  margin: 0 auto;
  padding: 0 1rem 4rem;
  font-family: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.625;
  color: #27272a;
  -webkit-font-smoothing: antialiased;
}

.kb-track-page *,
.kb-track-page *::before,
.kb-track-page *::after {
  box-sizing: border-box;
}

.kb-track-page h1,
.kb-track-page h2 {
  font-weight: 500;
  letter-spacing: 0.08em;
  margin: 0;
  color: var(--kb-text);
}

.kb-track-hero {
  padding: 0 0 2rem;
}

.kb-track-hero h1 {
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.kb-body {
  color: var(--kb-muted);
  font-size: 0.9375rem;
  line-height: 1.625;
}

.kb-body p {
  margin: 0.75rem 0 0;
}

.kb-card {
  padding: 1.25rem;
  border: 1px solid rgba(228, 228, 231, 0.9);
  border-radius: 1rem;
  background: #fff;
  box-shadow: var(--kb-card-shadow);
}

@media (min-width: 640px) {
  .kb-track-page {
    padding: 0 1.5rem 5rem;
  }

  .kb-card {
    padding: 1.5rem;
  }
}

.kb-field + .kb-field {
  margin-top: 1rem;
}

.kb-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--kb-text);
}

.kb-input {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 0.375rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d4d4d8;
  border-radius: 0.5rem;
  background: #fff;
  font: inherit;
  font-size: 16px;
  color: var(--kb-text);
}

.kb-input:focus {
  outline: 2px solid rgba(24, 24, 27, 0.15);
  outline-offset: 0;
}

.kb-input.is-invalid {
  border-color: #dc2626;
}

.kb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin-top: 1.25rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: #18181b;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
}

.kb-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kb-error {
  margin-top: 1rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  background: #fef2f2;
  font-size: 14px;
  color: #991b1b;
}

.kb-result {
  margin-top: 1.5rem;
}

.kb-result h2 {
  font-size: 1.125rem;
  letter-spacing: normal;
}

.kb-status-list {
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.kb-status-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 14px;
  font-weight: 500;
  color: var(--kb-text);
}

.kb-status-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  background: #f4f4f5;
  font-size: 11px;
  color: #71717a;
}

.kb-status-dot.is-done {
  background: #d1fae5;
  color: #065f46;
}

.kb-meta {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #f4f4f5;
}

.kb-meta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 14px;
}

.kb-meta-row dt {
  color: var(--kb-muted);
}

.kb-meta-row dd {
  margin: 0;
  font-weight: 500;
  color: var(--kb-text);
}

.kb-link {
  font-weight: 500;
  color: var(--kb-text);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.kb-track-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin-top: 1.25rem;
  padding: 0.625rem 1rem;
  border: 1px solid #d4d4d8;
  border-radius: 0.5rem;
  background: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--kb-text);
  text-decoration: none;
}

.kb-track-btn:hover {
  background: #fafafa;
}

.kb-hidden {
  display: none !important;
}
`.trim();

function trackOrderScript(apiUrl: string): string {
  return `
(function () {
  var API_URL = ${JSON.stringify(apiUrl)};
  var form = document.getElementById("kb-track-order-form");
  var errorEl = document.getElementById("kb-track-order-error");
  var resultEl = document.getElementById("kb-track-order-result");
  var submitBtn = document.getElementById("kb-track-order-submit");
  var orderInput = document.getElementById("kb-track-order-number");
  var emailInput = document.getElementById("kb-track-order-email");
  if (!form || !errorEl || !resultEl || !submitBtn || !orderInput || !emailInput) return;

  function setError(message) {
    if (!message) {
      errorEl.classList.add("kb-hidden");
      errorEl.textContent = "";
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove("kb-hidden");
  }

  function setInvalid(input, invalid) {
    if (invalid) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
    } else {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    }
  }

  function validate(orderNumber, email) {
    var errors = [];
    setInvalid(orderInput, false);
    setInvalid(emailInput, false);

    var digits = String(orderNumber || "").trim().replace(/^#/, "");
    if (!digits || !/^\\d+$/.test(digits)) {
      errors.push("Enter a valid order number (digits only).");
      setInvalid(orderInput, true);
    }

    var em = String(email || "").trim();
    if (!em || em.indexOf("@") === -1) {
      errors.push("Enter the email address used at checkout.");
      setInvalid(emailInput, true);
    }

    return { ok: errors.length === 0, errors: errors, orderNumber: digits, email: em };
  }

  function statusDot(done) {
    return '<span class="kb-status-dot' + (done ? " is-done" : "") + '" aria-hidden="true">' + (done ? "✓" : "·") + "</span>";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function renderResult(data) {
    var fulfilled =
      data.status &&
      data.status.toLowerCase().indexOf("unfulfilled") === -1 &&
      data.status.toLowerCase() !== "processing";

    var html = '<h2>Order #' + escapeHtml(data.orderNumber) + "</h2>";
    html += '<ul class="kb-status-list">';
    html += "<li>" + statusDot(fulfilled) + "<span>" + escapeHtml(data.status) + "</span></li>";
    html += "<li>" + statusDot(!!data.onItsWay) + "<span>On its way</span></li>";
    html += "</ul>";
    html += '<dl class="kb-meta">';

    if (data.carrier) {
      html += '<div class="kb-meta-row"><dt>Carrier</dt><dd>' + escapeHtml(data.carrier) + "</dd></div>";
    }

    if (data.trackingNumber) {
      html += '<div class="kb-meta-row"><dt>Tracking number</dt><dd>';
      if (data.trackingUrl) {
        html +=
          '<a class="kb-link" href="' +
          escapeAttr(data.trackingUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(data.trackingNumber) +
          "</a>";
      } else {
        html += escapeHtml(data.trackingNumber);
      }
      html += "</dd></div>";
    }

    html += "</dl>";

    if (data.trackingUrl) {
      html +=
        '<a class="kb-track-btn" href="' +
        escapeAttr(data.trackingUrl) +
        '" target="_blank" rel="noopener noreferrer">Track parcel</a>';
    }

    resultEl.innerHTML = html;
    resultEl.classList.remove("kb-hidden");
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function parseJsonResponse(res) {
    var contentType = res.headers.get("content-type") || "";
    if (contentType.indexOf("application/json") === -1) {
      return Promise.reject(new Error("not_json"));
    }
    return res.json();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    setError("");
    resultEl.classList.add("kb-hidden");
    resultEl.innerHTML = "";

    var checked = validate(orderInput.value, emailInput.value);
    if (!checked.ok) {
      setError(checked.errors.join(" "));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Looking up…";

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: checked.orderNumber,
        email: checked.email,
      }),
    })
      .then(function (res) {
        return parseJsonResponse(res).then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (payload) {
        if (!payload.res.ok || !payload.data || !payload.data.ok) {
          setError(
            (payload.data && payload.data.error) ||
              "We couldn't find an order matching those details.",
          );
          return;
        }
        renderResult(payload.data);
      })
      .catch(function (err) {
        if (err && err.message === "not_json") {
          setError("Order tracking is temporarily unavailable. Please try again shortly.");
          return;
        }
        setError("Could not reach the server. Check your connection and try again.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Track order";
      });
  });
})();
`.trim();
}

/** Self-contained HTML block for Shopify page / liquid section. */
export function buildShopifyTrackOrderHtml(): string {
  const apiUrl = `${TRACK_ORDER_API_BASE_URL.replace(/\/$/, "")}/api/track-order`;

  return `<div class="kb-track-page">
<style>${CSS}</style>
<article>
  <header class="kb-track-hero">
    <h1>${TRACK_ORDER_PAGE_COPY.title}</h1>
    <div class="kb-body"><p>${TRACK_ORDER_PAGE_COPY.intro}</p></div>
  </header>

  <section class="kb-card" aria-label="Track order form">
    <form id="kb-track-order-form" novalidate>
      <div class="kb-field">
        <label class="kb-label" for="kb-track-order-number">Order number</label>
        <input
          class="kb-input"
          id="kb-track-order-number"
          name="orderNumber"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="62127"
          required
        />
      </div>
      <div class="kb-field">
        <label class="kb-label" for="kb-track-order-email">Email address</label>
        <input
          class="kb-input"
          id="kb-track-order-email"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <p id="kb-track-order-error" class="kb-error kb-hidden" role="alert"></p>
      <button id="kb-track-order-submit" class="kb-btn" type="submit">Track order</button>
    </form>
  </section>

  <section id="kb-track-order-result" class="kb-card kb-result kb-hidden" aria-live="polite"></section>
</article>
<script>${trackOrderScript(apiUrl)}</script>
</div>`;
}
