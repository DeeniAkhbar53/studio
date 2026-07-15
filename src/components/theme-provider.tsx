
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { getSettings } from "@/lib/firebase/settingsService";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const applyInitialTheme = async () => {
        const isCustom = localStorage.getItem("colorThemeCustom") === "true";
        let savedTheme = localStorage.getItem("colorTheme");

        if (!isCustom) {
            try {
                const settings = await getSettings();
                const defaultTheme = (settings.defaultTheme as string) || 'blue';
                savedTheme = defaultTheme;
                localStorage.setItem("colorTheme", defaultTheme);
            } catch (error) {
                console.error("Failed to fetch default theme, using fallback.", error);
                if (!savedTheme) savedTheme = 'blue';
            }
        } else if (!savedTheme) {
            savedTheme = 'blue';
        }
        
        const allThemeClasses = ['theme-blue', 'theme-purple', 'theme-indigo', 'theme-teal', 'theme-emerald', 'theme-rose', 'theme-amber', 'theme-gray'];
        document.body.classList.remove(...allThemeClasses);
        if (savedTheme && savedTheme !== "blue") {
            document.body.classList.add(`theme-${savedTheme}`);
        }
    };
    
    applyInitialTheme();
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
