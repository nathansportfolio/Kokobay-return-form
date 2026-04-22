import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
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
          <WarehouseShell>{children}</WarehouseShell>
          <AppToaster />
        </MuiProvider>
      </body>
    </html>
  );
}
