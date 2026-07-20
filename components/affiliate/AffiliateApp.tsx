"use client";

import { useEffect, useState } from "react";
import {
  affiliateLogin,
  affiliateLogout,
  affiliateMe,
  clearAffiliateSessionToken,
} from "@/lib/affiliate/api";
import type { AffiliateAccount } from "@/lib/affiliate/types";
import { AffiliateAdmin } from "@/components/affiliate/AffiliateAdmin";
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard";
import { AffiliateLogin } from "@/components/affiliate/AffiliateLogin";

type ReadyState =
  | { status: "loading" }
  | { status: "loggedOut" }
  | { status: "admin"; account: AffiliateAccount }
  | { status: "affiliate"; account: AffiliateAccount };

export function AffiliateApp() {
  const [state, setState] = useState<ReadyState>({ status: "loading" });

  useEffect(() => {
    void (async () => {
      const me = await affiliateMe();
      if (!me.ok) {
        clearAffiliateSessionToken();
        setState({ status: "loggedOut" });
        return;
      }
      if (me.role === "admin") {
        setState({ status: "admin", account: me.account });
        return;
      }
      setState({ status: "affiliate", account: me.account });
    })();
  }, []);

  async function logout() {
    await affiliateLogout();
    setState({ status: "loggedOut" });
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[#F7F5F2] text-sm text-[#7A746C]">
        Loading…
      </div>
    );
  }

  if (state.status === "loggedOut") {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-[#F7F5F2]">
        <AffiliateLogin
          onSubmit={async (code, pin) => {
            const result = await affiliateLogin(code, pin);
            if (!result.ok) return result.error;
            if (result.role === "admin") {
              setState({ status: "admin", account: result.account });
            } else {
              setState({ status: "affiliate", account: result.account });
            }
            return null;
          }}
        />
      </div>
    );
  }

  if (state.status === "admin") {
    return <AffiliateAdmin account={state.account} onLogout={() => void logout()} />;
  }

  return (
    <AffiliateDashboard account={state.account} onLogout={() => void logout()} />
  );
}
