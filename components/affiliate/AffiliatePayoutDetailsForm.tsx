"use client";

import { useState } from "react";
import { updateAffiliatePayoutDetails } from "@/lib/affiliate/api";
import type { AffiliateAccount, AffiliatePayoutDetails } from "@/lib/affiliate/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-2.5 text-sm outline-none focus:border-[#E89292] focus:ring-2 focus:ring-[#E89292]/30";

function emptyDetails(): Omit<AffiliatePayoutDetails, "updatedAt"> {
  return {
    legalName: "",
    addressLine1: "",
    addressLine2: null,
    city: "",
    postcode: "",
    country: "United Kingdom",
    accountName: "",
    sortCode: "",
    accountNumber: "",
    iban: null,
  };
}

export function AffiliatePayoutDetailsForm({
  account,
  onSaved,
}: {
  account: AffiliateAccount;
  onSaved: (account: AffiliateAccount) => void;
}) {
  const existing = account.payoutDetails;
  const [legalName, setLegalName] = useState(existing?.legalName ?? "");
  const [addressLine1, setAddressLine1] = useState(existing?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(existing?.addressLine2 ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [postcode, setPostcode] = useState(existing?.postcode ?? "");
  const [country, setCountry] = useState(existing?.country ?? "United Kingdom");
  const [accountName, setAccountName] = useState(existing?.accountName ?? "");
  const [sortCode, setSortCode] = useState(existing?.sortCode ?? "");
  const [accountNumber, setAccountNumber] = useState(
    existing?.accountNumber ?? "",
  );
  const [iban, setIban] = useState(existing?.iban ?? "");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6 grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setError(null);
          setOkMsg(null);
          setBusy(true);
          const result = await updateAffiliatePayoutDetails({
            ...emptyDetails(),
            legalName,
            addressLine1,
            addressLine2: addressLine2.trim() || null,
            city,
            postcode,
            country,
            accountName,
            sortCode,
            accountNumber,
            iban: iban.trim() || null,
          });
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOkMsg("Payout details saved.");
          onSaved(result.account);
        })();
      }}
    >
      <p className="sm:col-span-2 text-sm text-[#7A746C]">
        We use this on your commission invoices so we can pay you.
      </p>
      <div className="sm:col-span-2">
        <label htmlFor="payee-legal" className="text-sm font-medium">
          Legal name
        </label>
        <input
          id="payee-legal"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          className={inputClass}
          placeholder="Name on your bank account"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="payee-line1" className="text-sm font-medium">
          Address line 1
        </label>
        <input
          id="payee-line1"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="payee-line2" className="text-sm font-medium">
          Address line 2{" "}
          <span className="font-normal text-[#8A8580]">(optional)</span>
        </label>
        <input
          id="payee-line2"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="payee-city" className="text-sm font-medium">
          City
        </label>
        <input
          id="payee-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="payee-postcode" className="text-sm font-medium">
          Postcode
        </label>
        <input
          id="payee-postcode"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="payee-country" className="text-sm font-medium">
          Country
        </label>
        <input
          id="payee-country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8580]">
          Bank details
        </p>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="payee-account-name" className="text-sm font-medium">
          Account name
        </label>
        <input
          id="payee-account-name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="payee-sort" className="text-sm font-medium">
          Sort code
        </label>
        <input
          id="payee-sort"
          value={sortCode}
          onChange={(e) => setSortCode(e.target.value)}
          className={inputClass}
          placeholder="12-34-56"
          required
        />
      </div>
      <div>
        <label htmlFor="payee-number" className="text-sm font-medium">
          Account number
        </label>
        <input
          id="payee-number"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) =>
            setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
          }
          className={inputClass}
          placeholder="12345678"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="payee-iban" className="text-sm font-medium">
          IBAN <span className="font-normal text-[#8A8580]">(optional)</span>
        </label>
        <input
          id="payee-iban"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="sm:col-span-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="sm:col-span-2 text-sm text-emerald-700" role="status">
          {okMsg}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1A1A1A] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save payout details"}
        </button>
      </div>
    </form>
  );
}
