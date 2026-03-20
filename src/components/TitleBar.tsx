import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Minus, Square, Copy, X, ChevronDown, Settings, Palette, Check } from "lucide-react";
import { THEMES, type ThemeId, getTheme } from "@/lib/themes";

interface TitleBarProps {
  themeId: ThemeId;
  onSetThemeId: (id: ThemeId) => void;
  onOpenTabSettings: () => void;
}

export default function TitleBar({
  themeId,
  onSetThemeId,
  onOpenTabSettings,
}: TitleBarProps) {
  const appWindow = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    // Check initial state
    appWindow.isMaximized().then(setMaximized);
    // Listen for resize changes
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized);
    });
    return () => { unlisten.then((f) => f()); };
  }, [appWindow]);

  const currentTheme = getTheme(themeId);
  const darkThemes = THEMES.filter((t) => t.mode === "dark");
  const lightThemes = THEMES.filter((t) => t.mode === "light");
  const styledThemes = THEMES.filter((t) => t.mode === "styled");

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 select-none items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm"
    >
      {/* Left: Logo + Menu */}
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-2 px-3 hover:bg-accent/60 focus:outline-none">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                D
              </span>
              <span className="text-sm font-semibold tracking-tight">DevDock</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={onOpenTabSettings}>
              <Settings className="mr-2 h-4 w-4" />
              탭 설정
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="mr-2 h-4 w-4" />
                테마
                <span
                  className="ml-auto inline-block h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: currentTheme.previewColor }}
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {/* Dark themes */}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  다크
                </div>
                {darkThemes.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => onSetThemeId(t.id)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: t.previewColor }}
                    />
                    <span className="flex-1">{t.label}</span>
                    {themeId === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                {/* Light themes */}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  라이트
                </div>
                {lightThemes.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => onSetThemeId(t.id)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: t.previewColor }}
                    />
                    <span className="flex-1">{t.label}</span>
                    {themeId === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                {/* Styled themes */}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  스타일
                </div>
                {styledThemes.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => onSetThemeId(t.id)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: t.previewColor }}
                    />
                    <span className="flex-1">{t.label}</span>
                    {themeId === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                appWindow.close();
              }}
            >
              종료
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Window controls */}
      <div className="flex">
        <button
          onClick={() => appWindow.minimize()}
          className="inline-flex h-9 w-11 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="inline-flex h-9 w-11 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          onClick={() => appWindow.close()}
          className="inline-flex h-9 w-11 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
