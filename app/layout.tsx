import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { AppToaster } from "@/components/AppToaster";
import { MuiProvider } from "@/components/mui/MuiProvider";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: { absolute: "KOKO BAY RETURNS" },
  description:
    "Enter your order number, choose what you are sending back, then post to our address. We email you when the parcel arrives; refund within 5–10 working days.",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} h-full bg-white font-sans text-zinc-900 antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <MuiProvider>
          <NextTopLoader
            color="#0ea5e9"
            height={3}
            showSpinner={false}
            zIndex={9999}
            shadow="0 0 10px rgb(14 165 233 / 0.35), 0 0 4px rgb(14 165 233 / 0.2)"
            crawlSpeed={200}
            speed={300}
            easing="cubic-bezier(0.3, 0, 0, 1)"
          />
          <div className="flex min-h-full flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
              <span className="min-w-0 text-sm font-normal tracking-[0.18em] text-zinc-900 sm:text-base dark:text-zinc-100">
                KOKO BAY RETURNS
              </span>
            </header>
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            <footer className="shrink-0 border-t border-zinc-200/90 bg-zinc-100 px-4 py-14 dark:border-zinc-800 dark:bg-zinc-900/40">
              <nav
                aria-label="Kokobay links"
                className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center text-xs text-zinc-600 sm:text-sm dark:text-zinc-400"
              >
                <a
                  href="https://www.kokobay.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-1 py-0.5 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                >
                  kokobay.co.uk
                </a>
                <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
                  ·
                </span>
                <a
                  href="https://www.kokobay.co.uk/pages/terms-conditions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-1 py-0.5 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                >
                  Terms & conditions
                </a>
                <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
                  ·
                </span>
                <a
                  href="https://www.kokobay.co.uk/pages/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-1 py-0.5 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                >
                  Privacy policy
                </a>
              </nav>
            </footer>
          </div>
          <AppToaster />
        </MuiProvider>
      </body>
    </html>
  );
}
