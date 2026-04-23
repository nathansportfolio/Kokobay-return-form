"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      className="print:hidden"
      position="bottom-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans text-sm",
        },
      }}
    />
  );
}
