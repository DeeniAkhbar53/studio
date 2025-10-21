
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { getSettings } from "@/lib/firebase/settingsService";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const applyInitialTheme = async () => {
        let savedTheme = localStorage.getItem("colorTheme");

        if (!savedTheme) {
            try {
                const settings = await getSettings();
                savedTheme = settings.defaultTheme || 'blue';
                localStorage.setItem("colorTheme", savedTheme);
            } catch (error) {
                console.error("Failed to fetch default theme, using fallback.", error);
                savedTheme = 'blue';
            }
        }
        
        document.body.classList.remove('theme-blue', 'theme-purple', 'theme-gray');
        if (savedTheme && savedTheme !== "blue") {
            document.body.classList.add(`theme-${savedTheme}`);
        }
    };
    
    applyInitialTheme();
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
