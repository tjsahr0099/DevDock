import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

declare const __APP_VERSION__: string;
import TitleBar from "@/components/TitleBar";
import NavBar from "@/components/NavBar";
import TabSettings from "@/components/TabSettings";
import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore, type TabConfig } from "@/stores/settingsStore";
import { getTheme } from "@/lib/themes";

const Home = lazy(() => import("@/pages/Home"));
const DbDoc = lazy(() => import("@/pages/DbDoc"));
const PumlViewer = lazy(() => import("@/pages/PumlViewer"));
const MdViewer = lazy(() => import("@/pages/MdViewer"));
const CallFlow = lazy(() => import("@/pages/CallFlow"));
const ServerManager = lazy(() => import("@/pages/ServerManager"));
const ServerMonitor = lazy(() => import("@/pages/ServerMonitor"));
const JsonTool = lazy(() => import("@/pages/JsonTool"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PAGE_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  home: Home,
  dbdoc: DbDoc,
  pumlviewer: PumlViewer,
  mdviewer: MdViewer,
  callflow: CallFlow,
  servermanager: ServerManager,
  servermonitor: ServerMonitor,
  jsontool: JsonTool,
};

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="css-spinner">
        <div /><div /><div /><div /><div /><div />
        <div /><div /><div /><div /><div /><div />
      </div>
    </div>
  );
}

function App() {
  const { theme, themeId, setThemeId } = useTheme();
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("devdock-active-tab") || "home",
  );
  const [tabSettingsOpen, setTabSettingsOpen] = useState(false);

  const {
    settings,
    tabConfigs,
    loaded,
    loadSettings,
    loadTabSettings,
    saveTabSettings,
    saveSettings,
  } = useSettingsStore();

  useEffect(() => {
    loadSettings();
    loadTabSettings();
  }, [loadSettings, loadTabSettings]);

  // Sync theme to settings (skip initial mount)
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    saveSettings({ theme, themeId });
  }, [theme, themeId, saveSettings]);

  const visibleTabs = useMemo(
    () =>
      [...tabConfigs]
        .filter((t) => t.visible)
        .sort((a, b) => a.order - b.order),
    [tabConfigs],
  );

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    localStorage.setItem("devdock-active-tab", id);
  };

  const handleSaveTabSettings = (tabs: TabConfig[]) => {
    saveTabSettings(tabs);
  };

  const currentTheme = getTheme(themeId);
  const navPosition = settings.navPosition ?? "top";
  const navDisplayMode = settings.navDisplayMode ?? "both";
  const isVerticalNav = navPosition === "left" || navPosition === "right";

  if (!loaded) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <TitleBar
          themeId={themeId}
          onSetThemeId={setThemeId}
          onOpenTabSettings={() => {}}
        />
        <Loading />
      </div>
    );
  }

  const PageComponent = PAGE_MAP[activeTab];

  const navBar = (
    <NavBar
      position={navPosition}
      displayMode={navDisplayMode}
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );

  const content = (
    <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
      <Suspense fallback={<Loading />}>
        {PageComponent && (
          <PageComponent
            key={activeTab}
            {...(activeTab === "home" ? { onNavigate: handleTabChange } : {})}
          />
        )}
      </Suspense>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar
        themeId={themeId}
        onSetThemeId={setThemeId}
        onOpenTabSettings={() => setTabSettingsOpen(true)}
      />

      <div className={`flex flex-1 min-h-0 ${isVerticalNav ? "flex-row" : "flex-col"}`}>
        {(navPosition === "top" || navPosition === "left") && navBar}
        {content}
        {(navPosition === "bottom" || navPosition === "right") && navBar}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-0.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: currentTheme.previewColor }}
          />
          <span className="text-[10px] text-muted-foreground">{currentTheme.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">v{__APP_VERSION__} · © 2026 ksm</span>
      </div>

      <TabSettings
        open={tabSettingsOpen}
        onOpenChange={setTabSettingsOpen}
        tabs={tabConfigs}
        onSave={handleSaveTabSettings}
      />
    </div>
  );
}

export default App;
