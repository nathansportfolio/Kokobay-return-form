"use client";

import { useEffect, useState } from "react";
import { AccordionChevron } from "@/components/AccordionChevron";
import { HowToReturnFaq } from "@/components/HowToReturnFaq";
import {
  HOW_TO_RETURN_LINKS,
  RETURN_POLICY_PARAGRAPHS,
} from "@/lib/howToReturnPageContent";
import {
  EnvelopeSimple,
  FileText,
  ListChecks,
  MagnifyingGlass,
  QrCode,
  Storefront,
  Truck,
  WarningCircle,
} from "@phosphor-icons/react";

const PRIMARY_CTA_CLASS =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-xl border border-zinc-200 bg-white bg-none px-6 py-3.5 text-sm font-medium tracking-[0.14em] text-zinc-900 no-underline decoration-transparent shadow-[0_2px_14px_-3px_rgba(0,0,0,0.22)] before:hidden after:hidden before:content-none after:content-none sm:w-auto sm:min-w-[16rem] dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-900";

const PRIMARY_CTA_TEXT_CLASS =
  "inline-block bg-transparent no-underline decoration-transparent before:hidden after:hidden before:content-none after:content-none";

const PREMIUM_CARD_CLASS =
  "rounded-2xl border border-zinc-200/90 bg-white p-6 text-zinc-900 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.08)] sm:p-10 dark:border-zinc-700/60 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-[0_4px_28px_-6px_rgba(0,0,0,0.35)]";

const BODY_CLASS = "text-[0.9375rem] leading-relaxed text-zinc-600 dark:text-zinc-300";

const SECTION_HEADING_CLASS =
  "text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400";

const RETURN_PORTAL_URL = HOW_TO_RETURN_LINKS.startReturn;

const RETURNS_ADDRESS = `KOKOBAY RETURNS
UNITS 8 & 9 ATLANTIC BUSINESS CENTRE
ATLANTIC STREET
ALTRINCHAM
WA14 5NQ`;

type TabId = "policy" | "start";

const TABS: { id: TabId; label: string }[] = [
  { id: "policy", label: "Returns Policy" },
  { id: "start", label: "Start A Return" },
];

function ReturnStep({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{
    className?: string;
    weight?: "duotone";
    "aria-hidden"?: boolean;
  }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon
        className="mt-0.5 h-6 w-6 shrink-0 text-zinc-900 dark:text-zinc-100"
        weight="duotone"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

function ParcelSealChecklist() {
  return (
    <div
      className="rounded-xl border border-dashed border-zinc-400 bg-white/70 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-zinc-600 dark:bg-zinc-950/35"
      role="note"
      aria-label="What to include in your parcel"
    >
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
        Check before you seal the box
      </p>
      <ol
        className="mt-2.5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-800 marker:font-medium dark:text-zinc-200"
        role="list"
      >
        <li>The item(s) you are returning</li>
        <li>
          The original A4 order sheet, or a clear written reference to your order number
        </li>
      </ol>
    </div>
  );
}

function ManualReturnsCheckNote() {
  return (
    <aside
      className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-4 sm:px-5 sm:py-5 dark:border-zinc-600 dark:bg-zinc-900/40"
      role="note"
      aria-label="Manual returns inspection"
    >
      <div className="flex gap-4">
        <ListChecks
          className="mt-0.5 h-7 w-7 shrink-0 text-zinc-900 dark:text-zinc-100"
          weight="duotone"
          aria-hidden
        />
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
            Please note
          </p>
          <p className={`text-sm leading-relaxed sm:text-[0.9375rem] ${BODY_CLASS}`}>
            <strong className="font-medium text-zinc-900 dark:text-zinc-50">
              We check every return manually
            </strong>{" "}
            before we issue a refund. Each parcel is inspected by our team to confirm the
            items, condition, and return details meet our policy.
          </p>
        </div>
      </div>
    </aside>
  );
}

function ReturnsPolicyPanel() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <ManualReturnsCheckNote />

      <section aria-labelledby="return-policy-heading">
        <h2 id="return-policy-heading" className={SECTION_HEADING_CLASS}>
          Return Policy
        </h2>
        <div className={`mt-8 space-y-6 sm:space-y-7 ${BODY_CLASS}`}>
          {RETURN_POLICY_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="faulty-items-heading"
        className={`${PREMIUM_CARD_CLASS} space-y-5`}
      >
        <div className="flex items-start gap-3">
          <WarningCircle
            className="mt-0.5 h-7 w-7 shrink-0 text-zinc-900 dark:text-zinc-100"
            weight="duotone"
            aria-hidden
          />
          <h2
            id="faulty-items-heading"
            className="text-base font-medium tracking-normal text-zinc-900 sm:text-lg dark:text-zinc-50"
          >
            Faulty Items:
          </h2>
        </div>

        <div className={`space-y-6 ${BODY_CLASS}`}>
          <p>
            If you believe you have recieved a faulty item, please contact us before sending
            the item back on:{" "}
            <a
              href={`mailto:${HOW_TO_RETURN_LINKS.email}`}
              className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              {HOW_TO_RETURN_LINKS.email}
            </a>{" "}
            with your name, a description of the fault, and a photo.
          </p>
          <p>
            To ensure quality control, all orders are carefully inspected by two different
            staff members before dispatch. All orders claimed as being faulty will be
            inspected by two staff members for any forcible damage/tampering made to the item.
            Any intentional or forcible damage or signs of tampering will void any refund.
          </p>
          <p>
            Faulty items will be replaced and sent back out to you at no extra cost, and your
            return shipping will be refunded back to you.
          </p>
        </div>
      </section>
    </div>
  );
}

function StartReturnPanel() {
  return (
    <div className="space-y-12 sm:space-y-16">
      <section aria-labelledby="start-return-heading" className="pt-2 sm:pt-4">
        <div className={`${PREMIUM_CARD_CLASS} mx-auto max-w-xl text-center`}>
          <p className={SECTION_HEADING_CLASS}>Start A Return</p>
          <h2
            id="start-return-heading"
            className="mt-4 text-xl font-medium tracking-normal text-zinc-900 sm:text-2xl dark:text-zinc-50"
          >
            Complete your return online
          </h2>
          <p className={`mx-auto mt-5 max-w-md ${BODY_CLASS}`}>
            Enter your order number, choose what you are sending back, then drop off at
            InPost or post to our address. We email you when the parcel arrives; refunds are
            usually processed within{" "}
            <strong className="font-medium text-zinc-900 dark:text-zinc-50">
              5–10 working days
            </strong>{" "}
            after we receive the items.
          </p>
          <div className="mt-8 sm:mt-10">
            <a
              href={RETURN_PORTAL_URL}
              className={PRIMARY_CTA_CLASS}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={PRIMARY_CTA_TEXT_CLASS}>START MY RETURN</span>
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="uk-return-steps-heading">
        <h2 id="uk-return-steps-heading" className={SECTION_HEADING_CLASS}>
          UK returns
        </h2>
        <div className="mt-8 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-sm leading-relaxed text-zinc-800 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200">
          <ul className="space-y-3" role="list" aria-label="How to return from the UK">
            <ReturnStep icon={MagnifyingGlass}>
              Enter your order number and the email address used on the order, then select
              the item(s) you wish to return.
            </ReturnStep>
            <ReturnStep icon={Truck}>
              Pack your return securely in suitable packaging (use original packaging and
              keep tags attached where possible) before you drop off.
            </ReturnStep>
            <ReturnStep icon={Storefront}>
              After submitting the form, press the{" "}
              <strong className="font-semibold">InPost Returns</strong> button to find your
              nearest InPost Locker or Shop.
            </ReturnStep>
            <ReturnStep icon={QrCode}>
              InPost will then email you a QR code to use at the locker — no printing
              required.
            </ReturnStep>
            <ReturnStep icon={EnvelopeSimple}>
              Once your parcel has been received and is being processed, we&apos;ll send you
              an email update.
            </ReturnStep>
          </ul>
        </div>
      </section>

      <details className="group rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
          <span
            id="outside-uk-return-steps-heading"
            className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
          >
            Returns from outside the UK
          </span>
          <AccordionChevron className="shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-400" />
        </summary>
        <div className="space-y-5 border-t border-zinc-200/80 px-4 pb-4 pt-4 text-sm leading-relaxed text-zinc-800 sm:px-5 sm:pb-5 sm:pt-5 dark:border-zinc-800 dark:text-zinc-200">
          <ul className="space-y-3" role="list" aria-label="How to return from outside the UK">
            <ReturnStep icon={MagnifyingGlass}>
              Enter your order number, the email on the order, and load your items.
            </ReturnStep>
            <ReturnStep icon={ListChecks}>
              Tick the items you are returning. You must choose a return reason for each
              selected item.
            </ReturnStep>
            <ReturnStep icon={FileText}>
              Put the <strong className="font-semibold">original A4 paper</strong> from your
              delivery inside the parcel with your items. If you no longer have it,{" "}
              <strong className="font-semibold">
                write your order number clearly on a slip of paper
              </strong>{" "}
              and place that inside the parcel instead.
            </ReturnStep>
            <ReturnStep icon={Truck}>
              Submit the form, then post your return to the address below (use a tracked or
              signed-for service and keep your proof of postage).
            </ReturnStep>
            <ReturnStep icon={EnvelopeSimple}>
              We will email you once your return is being processed.
            </ReturnStep>
          </ul>
          <ParcelSealChecklist />
          <div
            className="whitespace-pre-line rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 text-[0.8125rem] font-medium leading-relaxed text-zinc-900 shadow-sm sm:px-5 sm:py-5 sm:text-sm dark:border-zinc-700/50 dark:bg-zinc-900/40 dark:text-zinc-100"
            role="group"
            aria-label="Returns address"
          >
            {RETURNS_ADDRESS}
          </div>
        </div>
      </details>
    </div>
  );
}

export function HowToReturnPage() {
  const [activeTab, setActiveTab] = useState<TabId>("policy");

  useEffect(() => {
    const sendHeight = () => {
      window.parent.postMessage(
        {
          type: "returns-height",
          height: document.body.scrollHeight,
        },
        "*",
      );
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);

    return () => observer.disconnect();
  }, []);

  return (
    <article className="mx-auto w-full max-w-2xl text-zinc-800 dark:text-zinc-200">
      <header className="pb-8 sm:pb-10">
        <p className={`max-w-xl text-sm leading-relaxed sm:text-[0.9375rem] ${BODY_CLASS}`}>
        We want you to love your Kokobay pieces. If something isn’t quite right, returning them is simple.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Returns sections"
        className="flex border-b border-zinc-200 dark:border-zinc-800"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`returns-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`returns-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px min-h-12 flex-1 touch-manipulation border-b-2 px-3 py-3 text-xs font-medium tracking-[0.12em] transition-colors sm:px-4 sm:text-sm ${
                selected
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="pt-10 sm:pt-12">
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              id={`returns-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`returns-tab-${tab.id}`}
              hidden={!selected}
              className={selected ? undefined : "hidden"}
            >
              {tab.id === "policy" ? <ReturnsPolicyPanel /> : <StartReturnPanel />}
            </div>
          );
        })}
      </div>

      <HowToReturnFaq />
    </article>
  );
}
