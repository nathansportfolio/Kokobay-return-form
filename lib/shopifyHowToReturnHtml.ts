import {
  HOW_TO_RETURN_LINKS,
  OUTSIDE_UK_RETURN_STEPS,
  RETURN_POLICY_PARAGRAPHS,
  RETURNS_ADDRESS,
  UK_RETURN_STEPS,
  buildFaqCategories,
} from "./howToReturnPageContent";
import { ACCORDION_CHEVRON_SVG } from "./accordionChevron";

function stepsList(steps: readonly string[]): string {
  return `<ul class="kb-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ul>`;
}

function faqHtml(): string {
  const categories = buildFaqCategories(HOW_TO_RETURN_LINKS);
  return categories
    .map(
      (cat) => `
<section class="kb-faq-category">
  <h3 class="kb-section-label kb-faq-category-title">${cat.title}</h3>
  <div class="kb-faq-items">
    ${cat.items
      .map(
        (item) => `
    <details class="kb-faq-item">
      <summary class="kb-faq-question"><span>${item.question}</span>${ACCORDION_CHEVRON_SVG}</summary>
      <div class="kb-faq-answer kb-body">${item.answerHtml}</div>
    </details>`,
      )
      .join("")}
  </div>
</section>`,
    )
    .join("");
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap");

.kb-returns-page {
  --kb-text: #18181b;
  --kb-muted: #52525b;
  --kb-border: #e4e4e7;
  --kb-surface: #fafafa;
  --kb-card-shadow: 0 4px 28px -6px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  max-width: 42rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  font-family: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.625;
  color: #27272a;
  -webkit-font-smoothing: antialiased;
}

.kb-returns-page *,
.kb-returns-page *::before,
.kb-returns-page *::after {
  box-sizing: border-box;
}

.kb-returns-page h1,
.kb-returns-page h2,
.kb-returns-page h3 {
  font-weight: 400;
  letter-spacing: 0.18em;
  margin: 0;
}

.kb-section-label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--kb-muted);
}

.kb-hero {
  padding-bottom: 2.5rem;
}

.kb-hero h1 {
  margin-top: 1rem;
  font-size: clamp(1.875rem, 5vw, 3rem);
  letter-spacing: 0.22em;
  color: var(--kb-text);
}

.kb-body {
  color: var(--kb-muted);
  font-size: 0.9375rem;
  line-height: 1.625;
}

.kb-body p {
  margin: 0 0 1.25rem;
}

.kb-body p:last-child {
  margin-bottom: 0;
}

.kb-body ul,
.kb-body ol {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
}

.kb-body li {
  margin-bottom: 0.5rem;
}

.kb-strong {
  font-weight: 500;
  color: #27272a;
}

.kb-link {
  font-weight: 500;
  color: var(--kb-text);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.kb-note {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px dashed #d4d4d8;
  border-radius: 0.75rem;
  background: rgba(250, 250, 250, 0.8);
}

.kb-note-title {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--kb-muted);
  margin: 0 0 0.5rem;
}

.kb-stack-lg > * + * {
  margin-top: 4rem;
}

.kb-stack-md > * + * {
  margin-top: 3rem;
}

.kb-policy-copy > p + p {
  margin-top: 1.5rem;
}

.kb-card {
  padding: 1.5rem;
  border: 1px solid rgba(228, 228, 231, 0.9);
  border-radius: 1rem;
  background: #fff;
  box-shadow: var(--kb-card-shadow);
}

@media (min-width: 640px) {
  .kb-returns-page {
    padding: 3rem 1.5rem 5rem;
  }

  .kb-card {
    padding: 2.5rem;
  }

  .kb-stack-lg > * + * {
    margin-top: 5rem;
  }
}

.kb-card-center {
  max-width: 36rem;
  margin: 0 auto;
  text-align: center;
}

.kb-card-center h2 {
  margin-top: 1rem;
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  letter-spacing: normal;
  color: var(--kb-text);
}

.kb-card-center .kb-body {
  max-width: 28rem;
  margin: 1.25rem auto 0;
}

.kb-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  min-width: 16rem;
  margin-top: 2rem;
  padding: 0.875rem 1.5rem;
  border-radius: 0.75rem;
  background: var(--kb-text);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-decoration: none;
  box-shadow: 0 2px 14px -3px rgba(0, 0, 0, 0.22);
}

.kb-cta:hover {
  opacity: 0.92;
}

.kb-panel-box {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--kb-border);
  border-radius: 0.75rem;
  background: rgba(250, 250, 250, 0.6);
  font-size: 14px;
  line-height: 1.625;
  color: #27272a;
}

.kb-steps {
  list-style: none;
  margin: 0;
  padding: 0;
}

.kb-steps li {
  position: relative;
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.kb-steps li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--kb-text);
  font-weight: 600;
}

.kb-checklist {
  padding: 0.875rem 1rem 1rem;
  border: 1px dashed #a1a1aa;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.7);
}

.kb-checklist-title {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--kb-muted);
  margin: 0 0 0.625rem;
}

.kb-address {
  white-space: pre-line;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(228, 228, 231, 0.8);
  border-radius: 0.75rem;
  background: rgba(250, 250, 250, 0.8);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.625;
  color: var(--kb-text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.kb-faulty h2 {
  font-size: 1.125rem;
  letter-spacing: normal;
  color: var(--kb-text);
}

.kb-faulty .kb-body > p + p {
  margin-top: 1.5rem;
}

.kb-tab-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.kb-tabs {
  position: relative;
}

.kb-tab-list {
  display: flex;
  border-bottom: 1px solid var(--kb-border);
}

.kb-tab-label {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0.75rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: var(--kb-muted);
  cursor: pointer;
  text-align: center;
}

@media (min-width: 640px) {
  .kb-tab-label {
    font-size: 14px;
    padding: 0.75rem 1rem;
  }
}

#kb-tab-policy:checked ~ .kb-tab-list label[for="kb-tab-policy"],
#kb-tab-start:checked ~ .kb-tab-list label[for="kb-tab-start"] {
  border-bottom-color: var(--kb-text);
  color: var(--kb-text);
}

.kb-tab-panels {
  padding-top: 2.5rem;
}

.kb-tab-panel {
  display: none;
}

#kb-tab-policy:checked ~ .kb-tab-panels #kb-panel-policy,
#kb-tab-start:checked ~ .kb-tab-panels #kb-panel-start {
  display: block;
}

.kb-accordion {
  border: 1px solid var(--kb-border);
  border-radius: 0.75rem;
  background: rgba(250, 250, 250, 0.6);
}

.kb-chevron {
  flex-shrink: 0;
  margin-top: 0.125rem;
  color: var(--kb-muted);
  transition: transform 0.2s ease;
}

details[open] > summary .kb-chevron {
  transform: rotate(180deg);
}

.kb-accordion-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  list-style: none;
}

.kb-accordion-summary::-webkit-details-marker {
  display: none;
}

.kb-accordion-body {
  padding: 0 1.25rem 1.25rem;
  border-top: 1px solid rgba(228, 228, 231, 0.8);
}

.kb-accordion-body > * + * {
  margin-top: 1.25rem;
}

.kb-faq {
  margin-top: 5rem;
  padding-top: 3.5rem;
  border-top: 1px solid rgba(228, 228, 231, 0.9);
}

.kb-faq-header h2 {
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  letter-spacing: normal;
  color: var(--kb-text);
}

.kb-faq-header .kb-section-label {
  margin-top: 0.75rem;
}

.kb-faq-categories {
  margin-top: 2.5rem;
}

.kb-faq-categories > * + * {
  margin-top: 3.5rem;
}

.kb-faq-category-title {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(228, 228, 231, 0.8);
}

.kb-faq-item {
  border-bottom: 1px solid rgba(228, 228, 231, 0.8);
}

.kb-faq-question {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: normal;
  color: var(--kb-text);
  cursor: pointer;
  list-style: none;
}

.kb-faq-question > span {
  flex: 1;
  min-width: 0;
}

@media (min-width: 640px) {
  .kb-faq-question {
    font-size: 0.9375rem;
  }
}

.kb-faq-question::-webkit-details-marker {
  display: none;
}

.kb-faq-answer {
  padding: 0 0 1.25rem;
}
`.trim();

/** Self-contained HTML block for Shopify page / liquid section (no scripts). */
export function buildShopifyHowToReturnHtml(): string {
  const policyParagraphs = RETURN_POLICY_PARAGRAPHS.map((p) => `<p>${p}</p>`).join("");
  const startUrl = HOW_TO_RETURN_LINKS.startReturn;
  const faultyEmail = HOW_TO_RETURN_LINKS.email;

  return `<div class="kb-returns-page">
<style>${CSS}</style>
<article>
  <header class="kb-hero">
    <p class="kb-section-label">Returns information</p>
    <h1>RETURNS</h1>
    <p class="kb-body" style="margin-top:1.5rem;max-width:36rem;">Enter your order number, choose what you are sending back, then post to our address or drop off at InPost. We email you when the parcel arrives; refund within 5–10 working days.</p>
  </header>

  <div class="kb-tabs">
    <input class="kb-tab-input" type="radio" name="kb-returns-tab" id="kb-tab-policy" checked>
    <input class="kb-tab-input" type="radio" name="kb-returns-tab" id="kb-tab-start">

    <div class="kb-tab-list" role="tablist" aria-label="Returns sections">
      <label class="kb-tab-label" for="kb-tab-policy" role="tab">Returns Policy</label>
      <label class="kb-tab-label" for="kb-tab-start" role="tab">Start A Return</label>
    </div>

    <div class="kb-tab-panels">
      <section class="kb-tab-panel kb-stack-lg" id="kb-panel-policy" role="tabpanel" aria-labelledby="kb-tab-policy">
        <aside class="kb-note" aria-label="Manual returns inspection">
          <div>
            <p class="kb-note-title">Please note</p>
            <p class="kb-body"><strong style="font-weight:500;color:#18181b;">We check every return manually</strong> before we issue a refund. Each parcel is inspected by our team to confirm the items, condition, and return details meet our policy.</p>
          </div>
        </aside>

        <section aria-labelledby="return-policy-heading">
          <h2 class="kb-section-label" id="return-policy-heading">Return Policy</h2>
          <div class="kb-body kb-policy-copy" style="margin-top:2rem;">${policyParagraphs}</div>
        </section>

        <section aria-labelledby="returns-form-heading">
          <h2 class="kb-section-label" id="returns-form-heading">Returns Form</h2>
          <p class="kb-body" style="margin-top:2rem;">A returns form must be included when returning any item(s). If you cannot print this please include a piece of paper with your name, order number, item(s) being returned and reason code.</p>
        </section>

        <section class="kb-card kb-faulty" aria-labelledby="faulty-items-heading">
          <h2 id="faulty-items-heading">Faulty Items:</h2>
          <div class="kb-body" style="margin-top:1.25rem;">
            <p>If you believe you have recieved a faulty item, please contact us before sending the item back on: <a class="kb-link" href="mailto:${faultyEmail}">${faultyEmail}</a> with your name, a description of the fault, and a photo.</p>
            <p>To ensure quality control, all orders are carefully inspected by two different staff members before dispatch. All orders claimed as being faulty will be inspected by two staff members for any forcible damage/tampering made to the item. Any intentional or forcible damage or signs of tampering will void any refund.</p>
            <p>Faulty items will be replaced and sent back out to you at no extra cost, and your return shipping will be refunded back to you.</p>
          </div>
        </section>
      </section>

      <section class="kb-tab-panel kb-stack-md" id="kb-panel-start" role="tabpanel" aria-labelledby="kb-tab-start">
        <section class="kb-card kb-card-center" aria-labelledby="start-return-heading">
          <p class="kb-section-label">Start A Return</p>
          <h2 id="start-return-heading">Complete your return online</h2>
          <p class="kb-body">Enter your order number, choose what you are sending back, then drop off at InPost or post to our address. We email you when the parcel arrives; refunds are usually processed within <strong style="font-weight:500;color:#18181b;">5–10 working days</strong> after we receive the items.</p>
          <a class="kb-cta" href="${startUrl}" target="_blank" rel="noopener noreferrer">START MY RETURN</a>
        </section>

        <section aria-labelledby="uk-return-steps-heading">
          <h2 class="kb-section-label" id="uk-return-steps-heading">UK returns</h2>
          <div class="kb-panel-box">${stepsList(UK_RETURN_STEPS)}</div>
        </section>

        <details class="kb-accordion">
          <summary class="kb-accordion-summary">
            <span class="kb-section-label">Returns from outside the UK</span>
            ${ACCORDION_CHEVRON_SVG}
          </summary>
          <div class="kb-accordion-body">
            ${stepsList(OUTSIDE_UK_RETURN_STEPS)}
            <div class="kb-checklist" role="note" aria-label="What to include in your parcel">
              <p class="kb-checklist-title">Check before you seal the box</p>
              <ol class="kb-body" style="margin:0;padding-left:1.25rem;">
                <li>The item(s) you are returning</li>
                <li>The original A4 order sheet, or a clear written reference to your order number</li>
              </ol>
            </div>
            <div class="kb-address" role="group" aria-label="Returns address">${RETURNS_ADDRESS}</div>
          </div>
        </details>
      </section>
    </div>
  </div>

  <section class="kb-faq" aria-labelledby="need-help-heading">
    <header class="kb-faq-header">
      <h2 id="need-help-heading">Need help?</h2>
      <p class="kb-section-label">Frequently Asked Questions</p>
    </header>
    <div class="kb-faq-categories">${faqHtml()}</div>
  </section>
</article>
</div>`;
}
