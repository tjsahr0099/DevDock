import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface TabConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export type NavPosition = "top" | "bottom" | "left" | "right";
export type NavDisplayMode = "icon" | "both";

export interface Settings {
  theme: "light" | "dark";
  themeId?: string;
  mdViewerFolderPath?: string;
  mdViewerRecentPaths?: string[];
  pumlViewerFolderPath?: string;
  gitHistoryRepoPath?: string;
  gitHistoryRecentPaths?: string[];
  navPosition?: NavPosition;
  navDisplayMode?: NavDisplayMode;
}

interface SettingsStore {
  settings: Settings;
  tabConfigs: TabConfig[];
  loaded: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<Settings>) => Promise<void>;
  loadTabSettings: () => Promise<void>;
  saveTabSettings: (tabs: TabConfig[]) => Promise<void>;
  setTabConfigs: (tabs: TabConfig[]) => void;
}

const DEFAULT_TABS: TabConfig[] = [
  { id: "home", label: "홈", visible: true, order: 0 },
  { id: "dbdoc", label: "DB 정의서", visible: true, order: 1 },
  { id: "pumlviewer", label: "PUML 뷰어", visible: true, order: 2 },
  { id: "mdviewer", label: "마크다운 뷰어", visible: true, order: 3 },
  { id: "callflow", label: "호출 흐름", visible: true, order: 4 },
  { id: "servermanager", label: "서버 관리", visible: true, order: 5 },
  { id: "servermonitor", label: "서버 모니터링", visible: true, order: 6 },
  { id: "jsontool", label: "JSON Tool", visible: true, order: 7 },
  { id: "cicd", label: "CI/CD", visible: true, order: 8 },
  { id: "netcheck", label: "연결 검사", visible: true, order: 9 },
  { id: "githistory", label: "Git 히스토리", visible: true, order: 10 },
  { id: "apitester", label: "API 테스트", visible: true, order: 11 },
];

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: { theme: "dark" },
  tabConfigs: DEFAULT_TABS,
  loaded: false,

  loadSettings: async () => {
    try {
      const raw = await invoke<string>("get_settings");
      const settings = JSON.parse(raw) as Settings;
      set({ settings });
    } catch {
      // Use defaults
    }
  },

  saveSettings: async (partial: Partial<Settings>) => {
    try {
      const current = useSettingsStore.getState().settings;
      const merged = { ...current, ...partial };
      await invoke("save_settings", { data: JSON.stringify(merged) });
      set({ settings: merged });
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },

  loadTabSettings: async () => {
    try {
      const raw = await invoke<string>("get_tab_settings");
      let tabs = JSON.parse(raw) as TabConfig[];
      let changed = false;
      // Migrate: remove dashboard tab if present
      if (tabs.some((t) => t.id === "dashboard")) {
        tabs = tabs.filter((t) => t.id !== "dashboard");
        changed = true;
      }
      // Migrate: add any new tabs from DEFAULT_TABS that are missing
      const existingIds = new Set(tabs.map((t) => t.id));
      for (const def of DEFAULT_TABS) {
        if (!existingIds.has(def.id)) {
          tabs.push({ ...def, order: tabs.length });
          changed = true;
        }
      }
      if (changed) {
        tabs.sort((a, b) => a.order - b.order).forEach((t, i) => (t.order = i));
        invoke("save_tab_settings", { data: JSON.stringify(tabs) }).catch(() => {});
      }
      if (tabs.length > 0) {
        set({ tabConfigs: tabs, loaded: true });
        return;
      }
    } catch {
      // Use defaults
    }
    set({ loaded: true });
  },

  saveTabSettings: async (tabs: TabConfig[]) => {
    try {
      await invoke("save_tab_settings", { data: JSON.stringify(tabs) });
      set({ tabConfigs: tabs });
    } catch (e) {
      console.error("Failed to save tab settings:", e);
    }
  },

  setTabConfigs: (tabs: TabConfig[]) => set({ tabConfigs: tabs }),
}));
