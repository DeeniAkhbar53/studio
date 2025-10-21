"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("colorTheme") || "default";
    document.body.classList.remove('theme-default', 'theme-green', 'theme-zinc', 'theme-rose');
    if (savedTheme !== "default") {
        document.body.classList.add(`theme-${savedTheme}`);
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
