export type ThemeId =
  | "dark-default"
  | "dark-ocean"
  | "dark-forest"
  | "dark-rose"
  | "dark-midnight"
  | "light-default"
  | "light-sky"
  | "light-mint"
  | "light-peach"
  | "light-lavender";

export type ThemeMode = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  previewColor: string;
  cssOverrides: Record<string, string>;
}

export const THEMES: ThemeDefinition[] = [
  // ── Dark themes ──
  {
    id: "dark-default",
    label: "기본 다크",
    mode: "dark",
    previewColor: "hsl(0 0% 14.9%)",
    cssOverrides: {
      "--color-background": "hsl(0 0% 3.9%)",
      "--color-foreground": "hsl(0 0% 98%)",
      "--color-primary": "hsl(0 0% 98%)",
      "--color-primary-foreground": "hsl(0 0% 9%)",
      "--color-secondary": "hsl(0 0% 14.9%)",
      "--color-secondary-foreground": "hsl(0 0% 98%)",
      "--color-accent": "hsl(0 0% 14.9%)",
      "--color-accent-foreground": "hsl(0 0% 98%)",
      "--color-muted": "hsl(0 0% 14.9%)",
      "--color-muted-foreground": "hsl(0 0% 63.9%)",
      "--color-border": "hsl(0 0% 20%)",
      "--color-ring": "hsl(0 0% 83.1%)",
    },
  },
  {
    id: "dark-ocean",
    label: "오션",
    mode: "dark",
    previewColor: "hsl(199 89% 48%)",
    cssOverrides: {
      "--color-background": "hsl(222 47% 8%)",
      "--color-foreground": "hsl(210 40% 96%)",
      "--color-primary": "hsl(199 89% 48%)",
      "--color-primary-foreground": "hsl(222 47% 5%)",
      "--color-secondary": "hsl(222 30% 14%)",
      "--color-secondary-foreground": "hsl(210 40% 96%)",
      "--color-accent": "hsl(222 30% 18%)",
      "--color-accent-foreground": "hsl(210 40% 96%)",
      "--color-muted": "hsl(222 30% 14%)",
      "--color-muted-foreground": "hsl(215 20% 55%)",
      "--color-border": "hsl(222 25% 20%)",
      "--color-ring": "hsl(199 89% 48%)",
    },
  },
  {
    id: "dark-forest",
    label: "포레스트",
    mode: "dark",
    previewColor: "hsl(160 84% 39%)",
    cssOverrides: {
      "--color-background": "hsl(150 30% 6%)",
      "--color-foreground": "hsl(150 20% 96%)",
      "--color-primary": "hsl(160 84% 39%)",
      "--color-primary-foreground": "hsl(150 30% 4%)",
      "--color-secondary": "hsl(150 20% 12%)",
      "--color-secondary-foreground": "hsl(150 20% 96%)",
      "--color-accent": "hsl(150 20% 16%)",
      "--color-accent-foreground": "hsl(150 20% 96%)",
      "--color-muted": "hsl(150 20% 12%)",
      "--color-muted-foreground": "hsl(150 12% 55%)",
      "--color-border": "hsl(150 15% 18%)",
      "--color-ring": "hsl(160 84% 39%)",
    },
  },
  {
    id: "dark-rose",
    label: "로즈",
    mode: "dark",
    previewColor: "hsl(347 77% 64%)",
    cssOverrides: {
      "--color-background": "hsl(350 20% 7%)",
      "--color-foreground": "hsl(350 10% 96%)",
      "--color-primary": "hsl(347 77% 64%)",
      "--color-primary-foreground": "hsl(350 20% 5%)",
      "--color-secondary": "hsl(350 15% 13%)",
      "--color-secondary-foreground": "hsl(350 10% 96%)",
      "--color-accent": "hsl(350 15% 17%)",
      "--color-accent-foreground": "hsl(350 10% 96%)",
      "--color-muted": "hsl(350 15% 13%)",
      "--color-muted-foreground": "hsl(350 10% 55%)",
      "--color-border": "hsl(350 12% 20%)",
      "--color-ring": "hsl(347 77% 64%)",
    },
  },
  {
    id: "dark-midnight",
    label: "미드나잇",
    mode: "dark",
    previewColor: "hsl(263 70% 65%)",
    cssOverrides: {
      "--color-background": "hsl(263 40% 8%)",
      "--color-foreground": "hsl(263 20% 96%)",
      "--color-primary": "hsl(263 70% 65%)",
      "--color-primary-foreground": "hsl(263 40% 5%)",
      "--color-secondary": "hsl(263 25% 14%)",
      "--color-secondary-foreground": "hsl(263 20% 96%)",
      "--color-accent": "hsl(263 25% 18%)",
      "--color-accent-foreground": "hsl(263 20% 96%)",
      "--color-muted": "hsl(263 25% 14%)",
      "--color-muted-foreground": "hsl(263 15% 55%)",
      "--color-border": "hsl(263 20% 20%)",
      "--color-ring": "hsl(263 70% 65%)",
    },
  },

  // ── Light themes ──
  {
    id: "light-default",
    label: "기본 라이트",
    mode: "light",
    previewColor: "hsl(0 0% 89.8%)",
    cssOverrides: {
      "--color-background": "hsl(0 0% 100%)",
      "--color-foreground": "hsl(0 0% 3.9%)",
      "--color-primary": "hsl(0 0% 9%)",
      "--color-primary-foreground": "hsl(0 0% 98%)",
      "--color-secondary": "hsl(0 0% 96.1%)",
      "--color-secondary-foreground": "hsl(0 0% 9%)",
      "--color-accent": "hsl(0 0% 96.1%)",
      "--color-accent-foreground": "hsl(0 0% 9%)",
      "--color-muted": "hsl(0 0% 96.1%)",
      "--color-muted-foreground": "hsl(0 0% 45.1%)",
      "--color-border": "hsl(0 0% 89.8%)",
      "--color-ring": "hsl(0 0% 3.9%)",
    },
  },
  {
    id: "light-sky",
    label: "스카이",
    mode: "light",
    previewColor: "hsl(217 91% 50%)",
    cssOverrides: {
      "--color-background": "hsl(210 40% 98%)",
      "--color-foreground": "hsl(222 47% 11%)",
      "--color-primary": "hsl(217 91% 50%)",
      "--color-primary-foreground": "hsl(0 0% 100%)",
      "--color-secondary": "hsl(210 30% 93%)",
      "--color-secondary-foreground": "hsl(222 47% 11%)",
      "--color-accent": "hsl(210 30% 90%)",
      "--color-accent-foreground": "hsl(222 47% 11%)",
      "--color-muted": "hsl(210 30% 93%)",
      "--color-muted-foreground": "hsl(215 16% 47%)",
      "--color-border": "hsl(214 20% 85%)",
      "--color-ring": "hsl(217 91% 50%)",
    },
  },
  {
    id: "light-mint",
    label: "민트",
    mode: "light",
    previewColor: "hsl(160 84% 32%)",
    cssOverrides: {
      "--color-background": "hsl(150 30% 97%)",
      "--color-foreground": "hsl(150 30% 8%)",
      "--color-primary": "hsl(160 84% 32%)",
      "--color-primary-foreground": "hsl(0 0% 100%)",
      "--color-secondary": "hsl(150 20% 92%)",
      "--color-secondary-foreground": "hsl(150 30% 8%)",
      "--color-accent": "hsl(150 20% 89%)",
      "--color-accent-foreground": "hsl(150 30% 8%)",
      "--color-muted": "hsl(150 20% 92%)",
      "--color-muted-foreground": "hsl(150 10% 45%)",
      "--color-border": "hsl(150 15% 84%)",
      "--color-ring": "hsl(160 84% 32%)",
    },
  },
  {
    id: "light-peach",
    label: "피치",
    mode: "light",
    previewColor: "hsl(25 95% 53%)",
    cssOverrides: {
      "--color-background": "hsl(30 50% 97%)",
      "--color-foreground": "hsl(20 30% 10%)",
      "--color-primary": "hsl(25 95% 53%)",
      "--color-primary-foreground": "hsl(0 0% 100%)",
      "--color-secondary": "hsl(30 30% 92%)",
      "--color-secondary-foreground": "hsl(20 30% 10%)",
      "--color-accent": "hsl(30 30% 89%)",
      "--color-accent-foreground": "hsl(20 30% 10%)",
      "--color-muted": "hsl(30 30% 92%)",
      "--color-muted-foreground": "hsl(25 12% 48%)",
      "--color-border": "hsl(30 20% 84%)",
      "--color-ring": "hsl(25 95% 53%)",
    },
  },
  {
    id: "light-lavender",
    label: "라벤더",
    mode: "light",
    previewColor: "hsl(263 70% 55%)",
    cssOverrides: {
      "--color-background": "hsl(270 30% 98%)",
      "--color-foreground": "hsl(263 30% 10%)",
      "--color-primary": "hsl(263 70% 55%)",
      "--color-primary-foreground": "hsl(0 0% 100%)",
      "--color-secondary": "hsl(270 20% 93%)",
      "--color-secondary-foreground": "hsl(263 30% 10%)",
      "--color-accent": "hsl(270 20% 90%)",
      "--color-accent-foreground": "hsl(263 30% 10%)",
      "--color-muted": "hsl(270 20% 93%)",
      "--color-muted-foreground": "hsl(263 12% 48%)",
      "--color-border": "hsl(270 15% 85%)",
      "--color-ring": "hsl(263 70% 55%)",
    },
  },
];

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function getThemesByMode(mode: ThemeMode): ThemeDefinition[] {
  return THEMES.filter((t) => t.mode === mode);
}
