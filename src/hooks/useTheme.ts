import { useCallback, useEffect, useState } from "react";
import { type ThemeId, type ThemeMode, getTheme } from "@/lib/themes";

const STORAGE_KEY = "devdock-theme-id";
const LEGACY_KEY = "devdock-theme";

function migrateLegacyTheme(): ThemeId {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === "light") return "light-default";
  return "dark-default";
}

function loadSavedThemeId(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved as ThemeId;
  return migrateLegacyTheme();
}

function applyTheme(themeId: ThemeId) {
  const def = getTheme(themeId);
  const root = document.documentElement;

  // Set dark/light mode class
  if (def.cssMode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Apply CSS variable overrides
  for (const [key, value] of Object.entries(def.cssOverrides)) {
    root.style.setProperty(key, value);
  }

  // Also sync card/popover/input/destructive variables
  if (def.cssMode === "dark") {
    root.style.setProperty("--color-card", def.cssOverrides["--color-background"] ?? "");
    root.style.setProperty("--color-card-foreground", def.cssOverrides["--color-foreground"] ?? "");
    root.style.setProperty("--color-popover", def.cssOverrides["--color-background"] ?? "");
    root.style.setProperty("--color-popover-foreground", def.cssOverrides["--color-foreground"] ?? "");
    root.style.setProperty("--color-input", def.cssOverrides["--color-border"] ?? "");
  } else {
    root.style.setProperty("--color-card", def.cssOverrides["--color-background"] ?? "");
    root.style.setProperty("--color-card-foreground", def.cssOverrides["--color-foreground"] ?? "");
    root.style.setProperty("--color-popover", def.cssOverrides["--color-background"] ?? "");
    root.style.setProperty("--color-popover-foreground", def.cssOverrides["--color-foreground"] ?? "");
    root.style.setProperty("--color-input", def.cssOverrides["--color-border"] ?? "");
  }

  localStorage.setItem(STORAGE_KEY, themeId);
  // Keep legacy key in sync for backward compatibility
  localStorage.setItem(LEGACY_KEY, def.cssMode);
}

export function useTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>(loadSavedThemeId);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
  }, []);

  // Returns actual CSS mode: "light" | "dark"
  const theme = getTheme(themeId).cssMode;

  const toggleTheme = useCallback(() => {
    setThemeIdState((prev) => {
      const current = getTheme(prev);
      return current.mode === "dark" ? "light-default" : "dark-default";
    });
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeIdState(t === "dark" ? "dark-default" : "light-default");
  }, []);

  return { theme, themeId, toggleTheme, setTheme, setThemeId };
}
