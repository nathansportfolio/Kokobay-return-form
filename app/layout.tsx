import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";
import { MuiProvider } from "@/components/mui/MuiProvider";
import { WarehouseShell } from "@/components/WarehouseShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-white text-zinc-900 antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MuiProvider>
          <WarehouseShell>{children}</WarehouseShell>
          <AppToaster />
        </MuiProvider>
      </body>
    </html>
  );
}
