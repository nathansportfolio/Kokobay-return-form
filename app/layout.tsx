import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { AppToaster } from "@/components/AppToaster";
import { MuiProvider } from "@/components/mui/MuiProvider";
import { WarehouseShell } from "@/components/WarehouseShell";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: {
    default: "Kokobay Unit",
    template: "%s | Kokobay Unit",
  },
  description: "Internal warehouse tools for Kokobay Unit",
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
          <WarehouseShell>{children}</WarehouseShell>
          <AppToaster />
        </MuiProvider>
      </body>
    </html>
  );
}
