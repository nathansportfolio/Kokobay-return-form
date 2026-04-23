"use client";

import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import Image from "next/image";
import { useId, useState } from "react";
import { X } from "@phosphor-icons/react";
import {
  PICK_LIST_TB_ACTION,
  PICK_LIST_TB_SECONDARY,
} from "@/components/picklist/pickListToolbarClasses";

const IMAGE_SRC = "/images/rack-example.png";

/**
 * “How to find products” for today’s pick list — `public/images/rack-example.png`.
 */
export function PicklistHowToFindProductsButton() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
      >
        How to find products
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        scroll="body"
        slotProps={{ paper: { className: "max-h-[min(90dvh,900px)] overflow-y-auto" } }}
        aria-labelledby={titleId}
        aria-describedby={undefined}
      >
        <div className="relative w-full p-0">
          <IconButton
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="!absolute !right-2 !top-2 !z-10 h-9 w-9 rounded-full border border-zinc-200/80 !bg-white/90 text-zinc-800 shadow-sm hover:!bg-white dark:!border-zinc-600 dark:!bg-zinc-900/90 dark:text-zinc-100 dark:hover:!bg-zinc-800"
            size="small"
          >
            <X className="h-5 w-5" weight="bold" aria-hidden />
          </IconButton>
          <h2
            id={titleId}
            className="sr-only"
          >
            How to find products
          </h2>
          <div className="box-border w-full pt-10 sm:pt-12">
            <div className="px-1 pb-3 sm:px-2">
              <Image
                src={IMAGE_SRC}
                alt="Rack and bin code example: how to find products in the warehouse"
                width={1200}
                height={900}
                className="h-auto w-full rounded-md object-contain"
                priority={false}
                sizes="(max-width: 768px) 100vw, 896px"
              />
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
