import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Racking map",
  description: "How to read rack, bay, and level codes on the racking",
};

/** Same asset as the pick list “How to find products” helper — `public/images/rack-example.png`. */
const RACKING_MAP_PATH = "/images/rack-example.png";

export default function RackingMapPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <h1 className="sr-only">Racking map</h1>
      <div
        className="relative w-full flex-1 bg-zinc-100 dark:bg-zinc-950"
        style={{ minHeight: "max(0px, calc(100dvh - 3.5rem))" }}
      >
        <Image
          src={RACKING_MAP_PATH}
          alt="Racking map: how to find products using rack, bay, and level codes"
          fill
          priority
          className="object-contain object-center p-0 sm:p-1"
          sizes="100vw"
        />
      </div>
    </div>
  );
}
