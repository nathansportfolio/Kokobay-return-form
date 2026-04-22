"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";

const muiTheme = createTheme({
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

export function MuiProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}
