"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { SITE_ACCESS_COOKIE, type SiteAccessRole } from "@/lib/siteAccess";

const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days
const COOKIE_BASE = `path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;

function setSiteAccessCookie(role: SiteAccessRole) {
  document.cookie = `${SITE_ACCESS_COOKIE}=${role}; ${COOKIE_BASE}`;
  // remove legacy session cookie if present
  document.cookie = `auth=; path=/; max-age=0`;
}

export default function Login() {
  const [pin, setPin] = useState("");

  const handleLogin = () => {
    const value = pin.trim();
    const userPin = String(
      process.env.NEXT_PUBLIC_SITE_PIN_USER ?? "",
    ).trim();
    const adminPin = String(
      process.env.NEXT_PUBLIC_SITE_PIN_ADMIN ?? "",
    ).trim();

    if (adminPin.length > 0 && value === adminPin) {
      setSiteAccessCookie("admin");
      window.location.href = "/";
      return;
    }
    if (userPin.length > 0 && value === userPin) {
      setSiteAccessCookie("user");
      window.location.href = "/";
      return;
    }

    alert("Wrong PIN. Use the user or admin PIN you configured.");
  };

  return (
    <Stack
      className="w-full max-w-sm p-4 sm:p-0"
      spacing={2.5}
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        handleLogin();
      }}
    >
      <Typography
        component="h1"
        variant="h6"
        className="font-sans !tracking-normal"
        sx={{ fontWeight: 500 }}
      >
        Enter PIN
      </Typography>
      <TextField
        type="password"
        label="PIN"
        slotProps={{
          htmlInput: { inputMode: "numeric" as const, autoComplete: "one-time-code" },
        }}
        name="pin"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        fullWidth
        size="small"
        autoFocus
      />
      <Button type="submit" variant="contained" disableElevation fullWidth>
        Sign in
      </Button>
    </Stack>
  );
}
