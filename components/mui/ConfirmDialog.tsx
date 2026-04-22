"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** MUI button color for the primary action. */
  confirmColor?: "primary" | "error" | "warning" | "success" | "inherit";
  /** If true, confirm button uses contained variant. */
  confirmVariant?: "contained" | "outlined" | "text";
  /** Disable confirm (e.g. while saving). */
  confirmLoading?: boolean;
};

/**
 * Standard Material Design confirmation — use instead of <code>window.confirm</code>.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "primary",
  confirmVariant = "contained",
  confirmLoading = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={confirmLoading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <DialogTitle id="confirm-dialog-title" sx={{ pr: 2, pt: 2.5, pb: 1 }}>
        {title}
      </DialogTitle>
      <DialogContent id="confirm-dialog-desc" sx={{ pt: 0, pb: 1, color: "text.secondary" }}>
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          color="inherit"
          disabled={confirmLoading}
          size="large"
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant={confirmVariant}
          disabled={confirmLoading}
          size="large"
        >
          {confirmLoading ? "Please wait…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
