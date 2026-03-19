# TODO-019: 2단계 그룹 탭 구조로 변경 -- 설계

> 파일 위치: /docs/design/todo-019-two-level-grouped-tabs.design.md
> 대응 todo: /todo/todo-019-two-level-grouped-tabs.md
> 생성일: 2026-02-27

## 개요

현재 1단계 flat 탭(Radix Tabs)을 2단계 구조(1단계: 그룹 탭바, 2단계: 하위 탭바)로 변경한다. 그룹 예시: "홈"(단독), "문서 도구"(DB 정의서/PUML 뷰어/마크다운 뷰어), "개발 도구"(호출 흐름/JSON Tool), "서버"(서버 관리/서버 모니터링/대시보드). 단독 탭이거나 하위 탭이 1개뿐인 그룹은 2단계 탭바를 생략하고, 기존 `tab-settings.json` flat 형식에서 새 그룹 형식으로의 자동 마이그레이션을 지원한다.

## 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/stores/settingsStore.ts` | 수정 | `TabGroup`, `GroupedTabSettings` 타입 추가. 스토어에 그룹 데이터 관리 로직 및 마이그레이션 함수 추가 |
| `src/App.tsx` | 수정 | 1단계 그룹 탭바 + 2단계 하위 탭바의 2단계 탭 라우팅으로 전면 변경 |
| `src/components/TabSettings.tsx` | 수정 | 그룹 단위 설정 UI로 변경 (그룹별 표시/숨김, 그룹 내 탭 순서, 그룹 순서) |
| `src/pages/Home.tsx` | 수정 | `visibleTools` 계산 로직을 그룹 구조에 맞게 변경 |
| `data/tab-settings.json` | 수정 | 그룹 정보를 포함하는 새 스키마로 변환 (자동 마이그레이션) |

## 상세 설계

### 1. 데이터 모델 (`src/stores/settingsStore.ts`)

#### 새 타입 정의

기존 `TabConfig` 인터페이스는 유지하면서 그룹을 표현하는 새 타입을 추가한다.

```typescript
// --- 기존 유지 ---
export interface TabConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

// --- 신규 추가 ---

/** 탭 그룹 정의 */
export interface TabGroup {
  /** 그룹 고유 ID (예: "docs", "dev", "server") */
  id: string;
  /** 그룹 라벨 (1단계 탭바에 표시, 예: "문서 도구") */
  label: string;
  /** 그룹 표시 순서 (0-based) */
  order: number;
  /** 그룹 표시 여부 */
  visible: boolean;
  /** 그룹 내 탭 목록 (order 순 정렬) */
  tabs: TabConfig[];
}

/** 그룹 기반 탭 설정 (tab-settings.json의 새 스키마) */
export interface GroupedTabSettings {
  /** 스키마 버전 - flat 형식과 구분하기 위한 마커 */
  version: 2;
  /** 그룹 목록 */
  groups: TabGroup[];
}
```

#### 기본 그룹 설정 (DEFAULT_TAB_GROUPS)

```typescript
const DEFAULT_TAB_GROUPS: TabGroup[] = [
  {
    id: "home",
    label: "홈",
    order: 0,
    visible: true,
    tabs: [
      { id: "home", label: "홈", visible: true, order: 0 },
    ],
  },
  {
    id: "docs",
    label: "문서 도구",
    order: 1,
    visible: true,
    tabs: [
      { id: "dbdoc", label: "DB 정의서", visible: true, order: 0 },
      { id: "pumlviewer", label: "PUML 뷰어", visible: true, order: 1 },
      { id: "mdviewer", label: "마크다운 뷰어", visible: true, order: 2 },
    ],
  },
  {
    id: "dev",
    label: "개발 도구",
    order: 2,
    visible: true,
    tabs: [
      { id: "callflow", label: "호출 흐름", visible: true, order: 0 },
      { id: "jsontool", label: "JSON Tool", visible: true, order: 1 },
    ],
  },
  {
    id: "server",
    label: "서버",
    order: 3,
    visible: true,
    tabs: [
      { id: "servermanager", label: "서버 관리", visible: true, order: 0 },
      { id: "servermonitor", label: "서버 모니터링", visible: true, order: 1 },
      { id: "dashboard", label: "대시보드", visible: true, order: 2 },
    ],
  },
];
```

#### 마이그레이션 함수

기존 flat `TabConfig[]` 형식을 감지하여 새 그룹 형식으로 자동 변환한다.

```typescript
/**
 * 기존 flat TabConfig[] 형식인지 확인한다.
 * - version 필드가 없는 JSON 배열 -> flat 형식
 * - version: 2인 객체 -> 새 그룹 형식
 */
function isLegacyFlatFormat(data: unknown): data is TabConfig[] {
  return Array.isArray(data);
}

/**
 * flat TabConfig[]를 GroupedTabSettings로 마이그레이션한다.
 * 기존 탭의 visible/order 상태를 최대한 보존한다.
 */
function migrateFlatToGrouped(flatTabs: TabConfig[]): GroupedTabSettings {
  // 기존 탭의 visible 상태를 맵으로 저장
  const tabStateMap = new Map<string, { visible: boolean; label: string }>();
  for (const tab of flatTabs) {
    tabStateMap.set(tab.id, { visible: tab.visible, label: tab.label });
  }

  // 기본 그룹을 복사하되, 기존 탭의 visible/label 상태를 반영
  const groups = DEFAULT_TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.map((tab) => {
      const existing = tabStateMap.get(tab.id);
      if (existing) {
        return { ...tab, visible: existing.visible, label: existing.label };
      }
      return tab;
    }),
  }));

  // 그룹 내 모든 visible 탭이 없으면 그룹 자체를 hidden 처리
  for (const group of groups) {
    const hasVisibleTab = group.tabs.some((t) => t.visible);
    if (!hasVisibleTab) {
      group.visible = false;
    }
  }

  return { version: 2, groups };
}
```

#### 스토어 변경

`SettingsStore` 인터페이스와 구현을 다음과 같이 변경한다.

```typescript
interface SettingsStore {
  settings: Settings;
  /** [하위 호환] 모든 탭을 flat 목록으로 제공 (Home.tsx 등에서 사용) */
  tabConfigs: TabConfig[];
  /** 그룹 기반 탭 설정 */
  tabGroups: TabGroup[];
  loaded: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<Settings>) => Promise<void>;
  loadTabSettings: () => Promise<void>;
  saveTabSettings: (groups: TabGroup[]) => Promise<void>;
  /** [하위 호환] flat 목록 직접 설정 (사용처가 있을 경우) */
  setTabConfigs: (tabs: TabConfig[]) => void;
}
```

`loadTabSettings` 변경:

```typescript
loadTabSettings: async () => {
  try {
    const raw = await invoke<string>("get_tab_settings");
    const parsed = JSON.parse(raw);

    let groups: TabGroup[];

    if (isLegacyFlatFormat(parsed)) {
      // 기존 flat 형식 -> 마이그레이션
      const migrated = migrateFlatToGrouped(parsed);
      groups = migrated.groups;
      // 마이그레이션 결과를 즉시 저장 (다음 로드에서는 새 형식)
      await invoke("save_tab_settings", {
        data: JSON.stringify({ version: 2, groups } as GroupedTabSettings),
      });
    } else if (parsed && parsed.version === 2 && Array.isArray(parsed.groups)) {
      groups = (parsed as GroupedTabSettings).groups;
    } else {
      groups = DEFAULT_TAB_GROUPS;
    }

    // flat 목록도 함께 생성 (Home.tsx 등 하위 호환)
    const flatTabs = flattenGroups(groups);

    set({ tabGroups: groups, tabConfigs: flatTabs, loaded: true });
  } catch {
    set({ tabGroups: DEFAULT_TAB_GROUPS, tabConfigs: flattenDefaults(), loaded: true });
  }
},
```

`saveTabSettings` 변경:

```typescript
saveTabSettings: async (groups: TabGroup[]) => {
  try {
    const data: GroupedTabSettings = { version: 2, groups };
    await invoke("save_tab_settings", { data: JSON.stringify(data) });
    const flatTabs = flattenGroups(groups);
    set({ tabGroups: groups, tabConfigs: flatTabs });
  } catch (e) {
    console.error("Failed to save tab settings:", e);
  }
},
```

유틸리티 함수:

```typescript
/** 그룹 목록에서 모든 탭을 flat 목록으로 추출 (순서 유지) */
function flattenGroups(groups: TabGroup[]): TabConfig[] {
  const result: TabConfig[] = [];
  let globalOrder = 0;
  const sorted = [...groups].sort((a, b) => a.order - b.order);
  for (const group of sorted) {
    if (!group.visible) continue;
    const sortedTabs = [...group.tabs].sort((a, b) => a.order - b.order);
    for (const tab of sortedTabs) {
      result.push({ ...tab, order: globalOrder++ });
    }
  }
  return result;
}

function flattenDefaults(): TabConfig[] {
  return flattenGroups(DEFAULT_TAB_GROUPS);
}
```

#### 새 tab-settings.json 스키마 예시

```json
{
  "version": 2,
  "groups": [
    {
      "id": "home",
      "label": "홈",
      "order": 0,
      "visible": true,
      "tabs": [
        { "id": "home", "label": "홈", "visible": true, "order": 0 }
      ]
    },
    {
      "id": "docs",
      "label": "문서 도구",
      "order": 1,
      "visible": true,
      "tabs": [
        { "id": "dbdoc", "label": "DB 정의서", "visible": true, "order": 0 },
        { "id": "pumlviewer", "label": "PUML 뷰어", "visible": true, "order": 1 },
        { "id": "mdviewer", "label": "마크다운 뷰어", "visible": true, "order": 2 }
      ]
    },
    {
      "id": "dev",
      "label": "개발 도구",
      "order": 2,
      "visible": true,
      "tabs": [
        { "id": "callflow", "label": "호출 흐름", "visible": true, "order": 0 },
        { "id": "jsontool", "label": "JSON Tool", "visible": true, "order": 1 }
      ]
    },
    {
      "id": "server",
      "label": "서버",
      "order": 3,
      "visible": true,
      "tabs": [
        { "id": "servermanager", "label": "서버 관리", "visible": true, "order": 0 },
        { "id": "servermonitor", "label": "서버 모니터링", "visible": true, "order": 1 },
        { "id": "dashboard", "label": "대시보드", "visible": true, "order": 2 }
      ]
    }
  ]
}
```

---

### 2. App.tsx 2단계 탭 라우팅

#### 상태 관리 변경

기존 `activeTab`(단일 탭 ID)을 `activeGroupId`(선택된 그룹)와 `activeTabId`(선택된 하위 탭)로 분리한다.

```typescript
// 기존
const [activeTab, setActiveTab] = useState(
  () => localStorage.getItem("devdock-active-tab") || "home",
);

// 변경
const [activeGroupId, setActiveGroupId] = useState(
  () => localStorage.getItem("devdock-active-group") || "home",
);
const [activeTabId, setActiveTabId] = useState(
  () => localStorage.getItem("devdock-active-tab") || "home",
);
```

#### 스토어 사용 변경

```typescript
// 기존
const { tabConfigs, loaded, loadSettings, loadTabSettings, saveTabSettings, saveSettings } =
  useSettingsStore();

// 변경
const {
  tabGroups,
  tabConfigs, // Home.tsx 하위 호환용으로 유지
  loaded,
  loadSettings,
  loadTabSettings,
  saveTabSettings,
  saveSettings,
} = useSettingsStore();
```

#### 그룹/탭 계산 (useMemo)

```typescript
/** 표시할 그룹 목록 (visible + order 정렬) */
const visibleGroups = useMemo(
  () =>
    [...tabGroups]
      .filter((g) => g.visible)
      .sort((a, b) => a.order - b.order),
  [tabGroups],
);

/** 현재 선택된 그룹 */
const activeGroup = useMemo(
  () => visibleGroups.find((g) => g.id === activeGroupId) ?? visibleGroups[0],
  [visibleGroups, activeGroupId],
);

/** 현재 그룹의 표시할 하위 탭 목록 */
const visibleSubTabs = useMemo(() => {
  if (!activeGroup) return [];
  return [...activeGroup.tabs]
    .filter((t) => t.visible)
    .sort((a, b) => a.order - b.order);
}, [activeGroup]);

/** 2단계 탭바 표시 여부: 단독 탭(그룹 내 탭 1개)이면 숨김 */
const showSubTabs = visibleSubTabs.length > 1;
```

#### 그룹 아이콘 매핑

그룹에도 아이콘을 부여하기 위한 매핑을 추가한다. 기존 `TAB_ICONS`와 별도로 그룹 아이콘을 정의한다.

```typescript
import {
  Home as HomeIcon,
  LayoutDashboard,
  Database,
  FileImage,
  FileText,
  GitBranch,
  Server,
  Activity,
  FileJson,
  FileStack,   // 문서 도구 그룹 아이콘
  Code,        // 개발 도구 그룹 아이콘
  type LucideIcon,
} from "lucide-react";

/** 그룹 아이콘 매핑 */
const GROUP_ICONS: Record<string, LucideIcon> = {
  home: HomeIcon,
  docs: FileStack,
  dev: Code,
  server: Server,
};

/** 탭 아이콘 매핑 (기존과 동일) */
const TAB_ICONS: Record<string, LucideIcon> = {
  home: HomeIcon,
  dashboard: LayoutDashboard,
  dbdoc: Database,
  pumlviewer: FileImage,
  mdviewer: FileText,
  callflow: GitBranch,
  servermanager: Server,
  servermonitor: Activity,
  jsontool: FileJson,
};
```

#### 네비게이션 핸들러

```typescript
/**
 * 그룹 선택 시:
 * - 해당 그룹의 첫 번째 visible 탭을 자동 선택
 * - 단독 탭 그룹이면 그 탭을 바로 활성화
 */
const handleGroupChange = (groupId: string) => {
  setActiveGroupId(groupId);
  localStorage.setItem("devdock-active-group", groupId);

  const group = visibleGroups.find((g) => g.id === groupId);
  if (group) {
    const firstTab = [...group.tabs]
      .filter((t) => t.visible)
      .sort((a, b) => a.order - b.order)[0];
    if (firstTab) {
      setActiveTabId(firstTab.id);
      localStorage.setItem("devdock-active-tab", firstTab.id);
    }
  }
};

/** 하위 탭 선택 시 */
const handleTabChange = (tabId: string) => {
  setActiveTabId(tabId);
  localStorage.setItem("devdock-active-tab", tabId);
};

/**
 * 외부에서 특정 탭으로 네비게이션 (Home.tsx onNavigate 등)
 * 탭 ID로부터 소속 그룹을 찾아 그룹+탭을 함께 활성화
 */
const navigateToTab = (tabId: string) => {
  for (const group of visibleGroups) {
    const found = group.tabs.find((t) => t.id === tabId);
    if (found) {
      setActiveGroupId(group.id);
      setActiveTabId(tabId);
      localStorage.setItem("devdock-active-group", group.id);
      localStorage.setItem("devdock-active-tab", tabId);
      return;
    }
  }
};
```

#### 초기 로드 시 activeTab 복원

기존 localStorage에 flat `devdock-active-tab`만 저장되어 있을 수 있으므로, 로드 시 그룹 ID가 없으면 탭 ID로부터 그룹을 역추적한다.

```typescript
useEffect(() => {
  if (!loaded || visibleGroups.length === 0) return;

  // activeGroupId가 유효한 그룹인지 확인
  const groupExists = visibleGroups.some((g) => g.id === activeGroupId);
  if (!groupExists) {
    // activeTabId로부터 소속 그룹을 찾기
    for (const group of visibleGroups) {
      if (group.tabs.some((t) => t.id === activeTabId)) {
        setActiveGroupId(group.id);
        localStorage.setItem("devdock-active-group", group.id);
        return;
      }
    }
    // 못 찾으면 첫 번째 그룹/탭으로
    const first = visibleGroups[0];
    setActiveGroupId(first.id);
    const firstTab = first.tabs.filter((t) => t.visible).sort((a, b) => a.order - b.order)[0];
    if (firstTab) {
      setActiveTabId(firstTab.id);
      localStorage.setItem("devdock-active-group", first.id);
      localStorage.setItem("devdock-active-tab", firstTab.id);
    }
  }
}, [loaded, visibleGroups, activeGroupId, activeTabId]);
```

#### JSX 렌더링 (전체 변경)

```tsx
return (
  <div className="flex h-screen flex-col bg-background">
    <TitleBar
      themeId={themeId}
      onSetThemeId={setThemeId}
      onOpenTabSettings={() => setTabSettingsOpen(true)}
    />

    <div className="flex flex-1 flex-col overflow-hidden">
      {/* === 1단계: 그룹 탭바 === */}
      <div className="no-scrollbar shrink-0 flex items-center overflow-x-auto border-b border-border bg-transparent px-2">
        {visibleGroups.map((group) => {
          const Icon = GROUP_ICONS[group.id];
          const isActive = group.id === activeGroupId;
          return (
            <button
              key={group.id}
              onClick={() => handleGroupChange(group.id)}
              className={cn(
                "flex-none flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border-b-2 transition-colors duration-200",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {group.label}
            </button>
          );
        })}
      </div>

      {/* === 2단계: 하위 탭바 (탭이 2개 이상일 때만) === */}
      {showSubTabs && (
        <div className="no-scrollbar shrink-0 flex items-center overflow-x-auto border-b border-border/60 bg-muted/30 px-4">
          {visibleSubTabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id];
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex-none flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* === 페이지 콘텐츠 === */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {(() => {
          const PageComponent = PAGE_MAP[activeTabId];
          if (!PageComponent) return <Loading />;
          return (
            <Suspense fallback={<Loading />}>
              <PageComponent
                {...(activeTabId === "home"
                  ? { onNavigate: navigateToTab }
                  : {})}
              />
            </Suspense>
          );
        })()}
      </div>
    </div>

    {/* 상태 바 */}
    <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-0.5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: currentTheme.previewColor }}
        />
        <span className="text-[10px] text-muted-foreground">{currentTheme.label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">
        v{__APP_VERSION__} · (c) 2026 ksm
      </span>
    </div>

    <TabSettings
      open={tabSettingsOpen}
      onOpenChange={setTabSettingsOpen}
      groups={tabGroups}
      onSave={(groups) => saveTabSettings(groups)}
    />
  </div>
);
```

**핵심 변경 사항 정리**:

1. 기존 Radix `<Tabs>` 컴포넌트를 제거하고, 직접 `<button>`으로 1단계/2단계 탭바를 구현한다. Radix Tabs는 단일 레벨에 최적화되어 있어 2단계 중첩이 불편하므로, `cn()` 유틸리티를 활용한 커스텀 탭 버튼이 더 적합하다.
2. `<TabsContent>` 대신 조건부 렌더링으로 `PAGE_MAP[activeTabId]`를 직접 표시한다.
3. `cn()` 유틸리티 import가 필요하다: `import { cn } from "@/lib/utils";`

---

### 3. TabSettings.tsx 그룹 단위 설정 UI

기존 flat 목록 드래그 정렬을 **2단계 중첩 드래그**로 변경한다. 그룹 수준 드래그와 그룹 내 탭 드래그를 각각 지원한다.

#### Props 변경

```typescript
// 기존
interface TabSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: TabConfig[];
  onSave: (tabs: TabConfig[]) => void;
}

// 변경
interface TabSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TabGroup[];
  onSave: (groups: TabGroup[]) => void;
}
```

#### 전체 컴포넌트 구현

```typescript
// src/components/TabSettings.tsx

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { type TabGroup, type TabConfig } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface TabSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TabGroup[];
  onSave: (groups: TabGroup[]) => void;
}

/** 그룹 내 개별 탭 정렬 아이템 */
function SortableTab({
  tab,
  onToggle,
}: {
  tab: TabConfig;
  onToggle: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-1.5 ml-6"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox
        id={`tab-${tab.id}`}
        checked={tab.visible}
        onCheckedChange={() => onToggle(tab.id)}
      />
      <label htmlFor={`tab-${tab.id}`} className="flex-1 cursor-pointer text-xs">
        {tab.label}
      </label>
    </div>
  );
}

/** 그룹 정렬 아이템 (접기/펼치기 지원) */
function SortableGroup({
  group,
  isExpanded,
  onToggleExpand,
  onToggleVisible,
  onToggleTab,
  onTabDragEnd,
}: {
  group: TabGroup;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleTab: (groupId: string, tabId: string) => void;
  onTabDragEnd: (groupId: string, event: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortedTabs = [...group.tabs].sort((a, b) => a.order - b.order);
  const isSingleTab = group.tabs.length === 1;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1">
      {/* 그룹 헤더 */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Checkbox
          id={`group-${group.id}`}
          checked={group.visible}
          onCheckedChange={() => onToggleVisible(group.id)}
        />
        {/* 접기/펼치기 (단독 탭 그룹은 불필요) */}
        {!isSingleTab && (
          <button
            onClick={() => onToggleExpand(group.id)}
            className="text-muted-foreground hover:text-foreground focus:outline-none"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <label
          htmlFor={`group-${group.id}`}
          className={cn(
            "flex-1 cursor-pointer text-sm",
            isSingleTab ? "" : "font-medium",
          )}
        >
          {group.label}
          {!isSingleTab && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              ({group.tabs.filter((t) => t.visible).length}/{group.tabs.length})
            </span>
          )}
        </label>
      </div>

      {/* 그룹 내 탭 목록 (펼침 상태 + 복수 탭일 때만) */}
      {isExpanded && !isSingleTab && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => onTabDragEnd(group.id, event)}
        >
          <SortableContext
            items={sortedTabs.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                onToggle={(tabId) => onToggleTab(group.id, tabId)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export default function TabSettings({
  open,
  onOpenChange,
  groups,
  onSave,
}: TabSettingsProps) {
  const [localGroups, setLocalGroups] = useState<TabGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setLocalGroups([...groups].sort((a, b) => a.order - b.order));
      // 기본적으로 모든 복수 탭 그룹을 펼침
      setExpandedGroups(
        new Set(groups.filter((g) => g.tabs.length > 1).map((g) => g.id)),
      );
    }
  }, [open, groups]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleToggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleToggleGroupVisible = (groupId: string) => {
    setLocalGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, visible: !g.visible } : g,
      ),
    );
  };

  const handleToggleTab = (groupId: string, tabId: string) => {
    setLocalGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              tabs: g.tabs.map((t) =>
                t.id === tabId ? { ...t, visible: !t.visible } : t,
              ),
            }
          : g,
      ),
    );
  };

  /** 그룹 간 드래그 순서 변경 */
  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalGroups((prev) => {
        const oldIndex = prev.findIndex((g) => g.id === active.id);
        const newIndex = prev.findIndex((g) => g.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  /** 그룹 내 탭 드래그 순서 변경 */
  const handleTabDragEnd = (groupId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const oldIndex = g.tabs.findIndex((t) => t.id === active.id);
          const newIndex = g.tabs.findIndex((t) => t.id === over.id);
          return { ...g, tabs: arrayMove(g.tabs, oldIndex, newIndex) };
        }),
      );
    }
  };

  const handleSave = () => {
    const updated = localGroups.map((g, gi) => ({
      ...g,
      order: gi,
      tabs: g.tabs.map((t, ti) => ({ ...t, order: ti })),
    }));
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>탭 설정</DialogTitle>
          <DialogDescription>
            그룹 및 탭의 표시 여부와 순서를 설정합니다. 드래그하여 순서를
            변경할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleGroupDragEnd}
          >
            <SortableContext
              items={localGroups.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {localGroups.map((group) => (
                <SortableGroup
                  key={group.id}
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggleExpand={handleToggleExpand}
                  onToggleVisible={handleToggleGroupVisible}
                  onToggleTab={handleToggleTab}
                  onTabDragEnd={handleTabDragEnd}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**UI 구조 요약**:

```
+----------------------------------+
| 탭 설정                          |
| 그룹 및 탭의 표시 여부와 순서를  |
| 설정합니다. ...                  |
|                                  |
| [=] [v] 홈                      |  <- 단독 탭 (접기 불가)
|                                  |
| [=] [v] > 문서 도구 (3/3)       |  <- 그룹 (접기/펼치기)
|    [=] [v] DB 정의서             |  <- 그룹 내 탭 (들여쓰기)
|    [=] [v] PUML 뷰어            |
|    [=] [v] 마크다운 뷰어        |
|                                  |
| [=] [v] > 개발 도구 (2/2)       |
|    [=] [v] 호출 흐름             |
|    [=] [v] JSON Tool            |
|                                  |
| [=] [v] > 서버 (3/3)            |
|    [=] [v] 서버 관리             |
|    [=] [v] 서버 모니터링         |
|    [=] [v] 대시보드              |
|                                  |
|           [취소]   [저장]        |
+----------------------------------+
```

---

### 4. Home.tsx 변경

Home 컴포넌트는 `tabConfigs`(flat 목록)을 사용하여 도구 카드를 표시한다. 스토어에서 `flattenGroups()`로 생성된 `tabConfigs`를 계속 제공하므로, Home.tsx의 핵심 로직은 변경 불필요하다. 단, `onNavigate` 콜백이 App.tsx에서 `navigateToTab`으로 변경되므로 동작이 자동으로 그룹을 포함한 네비게이션으로 업데이트된다.

**변경 사항**: 없음 (App.tsx에서 `onNavigate={navigateToTab}`으로 전달하므로 Home.tsx 코드는 그대로).

---

### 5. 백엔드 변경 사항

**없음.** 백엔드의 `get_tab_settings`/`save_tab_settings` 커맨드는 JSON 문자열을 그대로 읽고 쓰므로, 스키마 변경에 영향받지 않는다. 마이그레이션 로직은 프론트엔드(`settingsStore.ts`)에서 수행한다. 새로운 Tauri 커맨드 추가가 필요하지 않다.

---

### 6. CSS 변경 (`src/index.css`)

2단계 탭바의 스타일링은 대부분 Tailwind 유틸리티 클래스로 처리하므로 별도 CSS 추가가 최소화된다. 다만 2단계 탭바의 부드러운 전환 애니메이션을 위해 다음을 추가한다.

```css
/* == Two-level tabs transition == */
@keyframes subTabEnter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sub-tab-bar-enter {
  animation: subTabEnter 200ms ease-out;
}
```

2단계 탭바의 `<div>` 에 `sub-tab-bar-enter` 클래스를 적용한다:

```tsx
{showSubTabs && (
  <div className="sub-tab-bar-enter no-scrollbar shrink-0 flex items-center ...">
    ...
  </div>
)}
```

---

### 7. 아키텍처 다이어그램

```
tab-settings.json
  |
  +-- [version 없음, 배열] --> migrateFlatToGrouped() --> GroupedTabSettings
  +-- [version: 2] --> GroupedTabSettings 직접 사용
  |
  v
settingsStore.ts
  |
  +-- tabGroups: TabGroup[]         (그룹 기반 구조)
  +-- tabConfigs: TabConfig[]       (flat 목록, 하위 호환)
  |
  v
App.tsx
  |
  +-- 1단계 탭바: visibleGroups.map() --> 그룹 버튼
  |     |
  |     +-- handleGroupChange(groupId)
  |           --> setActiveGroupId
  |           --> 자동으로 첫 번째 탭 선택
  |
  +-- 2단계 탭바: visibleSubTabs.map() --> 탭 버튼
  |     |                    (showSubTabs === false면 숨김)
  |     +-- handleTabChange(tabId)
  |
  +-- 콘텐츠: PAGE_MAP[activeTabId]
  |
  +-- navigateToTab(tabId)  --> Home.tsx onNavigate로 전달
  |     --> 그룹 역추적 후 그룹+탭 동시 활성화
  |
  v
TabSettings.tsx
  |
  +-- 그룹 레벨 DndContext (그룹 순서 변경)
  |     |
  |     +-- SortableGroup
  |           |
  |           +-- 그룹 내 DndContext (탭 순서 변경)
  |                 |
  |                 +-- SortableTab
  |
  +-- onSave(groups) --> saveTabSettings(groups) --> tab-settings.json
```

---

### 8. 파일별 전체 변경 사항 명세

#### `src/stores/settingsStore.ts` (수정)

| 변경 위치 | 변경 내용 |
|----------|----------|
| 타입 정의 | `TabGroup`, `GroupedTabSettings` 인터페이스 추가 |
| 상수 | `DEFAULT_TAB_GROUPS` 추가, `DEFAULT_TABS` 유지 (참조용) |
| 유틸리티 함수 | `isLegacyFlatFormat()`, `migrateFlatToGrouped()`, `flattenGroups()`, `flattenDefaults()` 추가 |
| 스토어 인터페이스 | `tabGroups: TabGroup[]` 필드 추가 |
| `loadTabSettings` | flat/grouped 형식 감지 및 마이그레이션 로직 |
| `saveTabSettings` | 시그니처 변경: `(tabs: TabConfig[])` -> `(groups: TabGroup[])` |

#### `src/App.tsx` (수정)

| 변경 위치 | 변경 내용 |
|----------|----------|
| import | `cn` 추가, `FileStack`, `Code` 아이콘 추가, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` 제거 |
| 상수 | `GROUP_ICONS` 추가 |
| 상태 | `activeTab` -> `activeGroupId` + `activeTabId` 분리 |
| 스토어 사용 | `tabGroups` 추가 사용 |
| useMemo | `visibleGroups`, `activeGroup`, `visibleSubTabs`, `showSubTabs` 추가 |
| 핸들러 | `handleGroupChange`, `handleTabChange`, `navigateToTab` 추가 |
| useEffect | 초기 로드 시 그룹 복원 로직 추가 |
| JSX | Radix Tabs -> 커스텀 2단계 탭바 + 조건부 렌더링 전면 변경 |
| TabSettings | props 변경: `tabs={tabConfigs}` -> `groups={tabGroups}`, `onSave` 시그니처 변경 |

#### `src/components/TabSettings.tsx` (수정)

| 변경 위치 | 변경 내용 |
|----------|----------|
| Props | `tabs: TabConfig[]` -> `groups: TabGroup[]`, `onSave` 시그니처 변경 |
| import | `ChevronDown`, `ChevronRight`, `cn`, `TabGroup` 추가 |
| 컴포넌트 | `SortableGroup` 신규 (그룹 레벨 드래그+접기/펼치기), `SortableTab` 스타일 변경 (들여쓰기) |
| 상태 | `localTabs` -> `localGroups`, `expandedGroups` 추가 |
| 드래그 | 2단계 DndContext: 그룹 간 + 그룹 내 탭 |
| 다이얼로그 | 너비 `sm:max-w-md` -> `sm:max-w-lg`, 설명 텍스트 변경, 스크롤 영역 추가 |

#### `src/index.css` (수정)

| 변경 위치 | 변경 내용 |
|----------|----------|
| 파일 끝 | `@keyframes subTabEnter` + `.sub-tab-bar-enter` 추가 |

#### `data/tab-settings.json` (수정 - 자동)

마이그레이션 시 기존 flat 배열이 `{ version: 2, groups: [...] }` 형식으로 자동 변환되어 저장된다.

## 영향 범위

- **App.tsx**: 1단계 flat Radix Tabs가 2단계 커스텀 탭바로 전면 변경된다. 가장 큰 변경이며 사용자 UI가 직접 변경된다.
- **TabSettings 다이얼로그**: 그룹 단위 관리 UI로 변경된다. 기존 단순 리스트 대비 정보 밀도가 높아지지만 직관적으로 유지한다.
- **Home 페이지**: 코드 변경 없음. `onNavigate` 콜백만 App.tsx에서 `navigateToTab`으로 교체되어 그룹 네비게이션이 자동 적용된다.
- **개별 페이지 컴포넌트** (DbDoc, PumlViewer, MdViewer 등): 변경 없음. PAGE_MAP 매커니즘이 동일하게 유지된다.
- **백엔드**: 변경 없음. JSON 직렬화/역직렬화만 수행하므로 스키마 변경에 투명하다.
- **localStorage**: `devdock-active-group` 키가 새로 추가된다. 기존 `devdock-active-tab`은 유지된다.
- **기존 데이터**: `tab-settings.json`의 기존 flat 형식은 첫 로드 시 자동 마이그레이션된다. 마이그레이션 후 기존 탭의 visible 상태가 보존된다.

## 테스트 포인트

- [ ] **마이그레이션 - flat -> grouped**: 기존 flat `tab-settings.json`으로 앱 시작 시 자동으로 그룹 형식으로 변환되고 저장되는지 확인
- [ ] **마이그레이션 - visible 보존**: 기존에 숨겨둔 탭이 마이그레이션 후에도 숨김 상태인지 확인
- [ ] **마이그레이션 - 이미 grouped**: `version: 2` 형식인 경우 재마이그레이션 없이 그대로 로드되는지 확인
- [ ] **1단계 탭바**: 그룹 아이콘 + 라벨이 표시되고, 클릭 시 해당 그룹이 활성화되는지 확인
- [ ] **2단계 탭바**: 그룹 선택 시 해당 그룹의 하위 탭이 2단계 탭바에 표시되는지 확인
- [ ] **단독 탭 그룹**: "홈" 그룹 클릭 시 2단계 탭바 없이 바로 콘텐츠가 표시되는지 확인
- [ ] **하위 탭 1개**: 그룹 내 visible 탭이 1개만 남은 경우 2단계 탭바가 숨겨지는지 확인
- [ ] **그룹 자동 선택**: 그룹 클릭 시 해당 그룹의 첫 번째 visible 탭이 자동 선택되는지 확인
- [ ] **Home onNavigate**: 홈 페이지에서 도구 카드 클릭 시 해당 그룹+탭이 함께 활성화되는지 확인
- [ ] **localStorage 복원**: 앱 재시작 시 마지막 활성 그룹+탭이 복원되는지 확인
- [ ] **localStorage 마이그레이션**: 기존에 `devdock-active-group` 없이 `devdock-active-tab`만 있을 때 그룹이 역추적되는지 확인
- [ ] **TabSettings - 그룹 순서**: 그룹을 드래그하여 순서를 변경하고 저장하면 반영되는지 확인
- [ ] **TabSettings - 그룹 숨김**: 그룹 체크박스 해제 후 저장하면 1단계 탭바에서 사라지는지 확인
- [ ] **TabSettings - 탭 순서**: 그룹 내 탭을 드래그하여 순서를 변경하고 저장하면 2단계 탭바에 반영되는지 확인
- [ ] **TabSettings - 탭 숨김**: 그룹 내 개별 탭 체크박스 해제 후 저장하면 2단계 탭바에서 사라지는지 확인
- [ ] **TabSettings - 접기/펼치기**: 그룹의 접기/펼치기 토글이 정상 동작하는지 확인
- [ ] **다크/라이트 테마**: 양쪽 테마에서 1단계/2단계 탭바가 올바르게 표시되는지 확인
- [ ] **탭바 스크롤**: 그룹 또는 하위 탭이 많아 가로 넘침 시 `overflow-x-auto`로 스크롤되는지 확인
- [ ] **빈 그룹 방지**: 모든 그룹이 숨겨진 경우 최소 1개 그룹이 표시되도록 방어 로직 확인
- [ ] **2단계 전환 애니메이션**: 그룹 변경 시 2단계 탭바가 `subTabEnter` 애니메이션으로 부드럽게 나타나는지 확인
