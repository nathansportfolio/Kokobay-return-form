/**
 * KOKO BAY — affiliate click tracker for Shopify theme.
 *
 * Install: Online Store → Themes → Edit code → theme.liquid
 * Paste before </body> (or in a Custom Liquid section on every page).
 *
 * Affiliate links: https://your-store.com/?ref=SOPHIE
 * Also accepts: ?aff=SOPHIE  or  ?discount=SOPHIE10
 *
 * Ensure Kokobay env AFFILIATE_ALLOWED_ORIGINS includes your store origin
 * (e.g. https://kokobay.com) if that env var is set.
 */
(function () {
  var TRACK_URL = "https://kokobay-mizd.vercel.app/api/affiliate/track";
  var STORAGE_KEY = "kb_affiliate_ref";
  var SESSION_KEY = "kb_affiliate_tracked";
  var COOKIE_DAYS = 30;

  function readQueryCode() {
    try {
      var params = new URLSearchParams(window.location.search);
      return (
        params.get("ref") ||
        params.get("aff") ||
        params.get("discount") ||
        params.get("code") ||
        ""
      )
        .trim()
        .toUpperCase();
    } catch (e) {
      return "";
    }
  }

  function setCookie(name, value, days) {
    var maxAge = days * 24 * 60 * 60;
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  function getCookie(name) {
    var parts = ("; " + document.cookie).split("; " + name + "=");
    if (parts.length < 2) return "";
    return decodeURIComponent(parts.pop().split(";").shift() || "");
  }

  function remember(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {}
    setCookie(STORAGE_KEY, code, COOKIE_DAYS);
  }

  function recalled() {
    try {
      var fromLs = (localStorage.getItem(STORAGE_KEY) || "").trim();
      if (fromLs) return fromLs.toUpperCase();
    } catch (e) {}
    return (getCookie(STORAGE_KEY) || "").trim().toUpperCase();
  }

  function alreadyTrackedThisSession(code) {
    try {
      return sessionStorage.getItem(SESSION_KEY) === code;
    } catch (e) {
      return false;
    }
  }

  function markTracked(code) {
    try {
      sessionStorage.setItem(SESSION_KEY, code);
    } catch (e) {}
  }

  var fromQuery = readQueryCode();
  if (fromQuery) remember(fromQuery);

  var code = fromQuery || recalled();
  if (!code) return;
  if (alreadyTrackedThisSession(code)) return;

  markTracked(code);

  fetch(TRACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      affiliateCode: code,
      url: window.location.href,
      referrer: document.referrer || "",
    }),
    credentials: "omit",
    keepalive: true,
  }).catch(function () {});
})();
