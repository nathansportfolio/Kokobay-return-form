import type { Metadata } from "next";
import Image from "next/image";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Floor map",
  description: "Warehouse floor map",
};

/** Place the map file at `public/images/floor-map.png` (or change extension below). */
const FLOOR_MAP_PATH = "/images/floor-map.png";

export default function FloorMapPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <div
        className="relative w-full flex-1 bg-zinc-100 dark:bg-zinc-950"
        style={{ minHeight: "max(0px, calc(100dvh - 3.5rem))" }}
      >
        <Image
          src={FLOOR_MAP_PATH}
          alt="Warehouse floor map"
          fill
          priority
          className="object-contain object-center p-0 sm:p-1"
          sizes="100vw"
        />
      </div>
    </div>
  );
}
