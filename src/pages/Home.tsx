import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  Database,
  FileImage,
  FileText,
  GitBranch,
  Server,
  Activity,
  FileJson,
  type LucideIcon,
} from "lucide-react";

interface ToolDef {
  id: string;
  icon: LucideIcon;
  description: string;
  accentColor: string;
}

const TOOL_DEFS: ToolDef[] = [
  {
    id: "dbdoc",
    icon: Database,
    description: "DB 테이블 정의서 생성",
    accentColor: "hsl(160 84% 39%)",
  },
  {
    id: "pumlviewer",
    icon: FileImage,
    description: "PlantUML 다이어그램 뷰어",
    accentColor: "hsl(263 70% 65%)",
  },
  {
    id: "mdviewer",
    icon: FileText,
    description: "마크다운 파일 미리보기",
    accentColor: "hsl(25 95% 53%)",
  },
  {
    id: "callflow",
    icon: GitBranch,
    description: "Java 호출 흐름 분석",
    accentColor: "hsl(347 77% 64%)",
  },
  {
    id: "servermanager",
    icon: Server,
    description: "SSH 서버 등록 및 관리",
    accentColor: "hsl(173 80% 40%)",
  },
  {
    id: "servermonitor",
    icon: Activity,
    description: "서버 리소스 모니터링",
    accentColor: "hsl(217 91% 50%)",
  },
  {
    id: "jsontool",
    icon: FileJson,
    description: "JSON 포맷팅 및 검증",
    accentColor: "hsl(45 93% 47%)",
  },
];

export default function Home({ onNavigate }: { onNavigate?: (tabId: string) => void }) {
  const { tabConfigs } = useSettingsStore();

  const visibleTools = useMemo(() => {
    const visible = tabConfigs
      .filter((t) => t.visible && t.id !== "home")
      .sort((a, b) => a.order - b.order);
    return visible
      .map((tab) => {
        const def = TOOL_DEFS.find((d) => d.id === tab.id);
        if (!def) return null;
        return { ...def, label: tab.label };
      })
      .filter(Boolean) as (ToolDef & { label: string })[];
  }, [tabConfigs]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg">
          D
        </div>
        <h1 className="text-2xl font-bold tracking-tight">DevDock</h1>
        <p className="text-sm text-muted-foreground">
          개발자를 위한 올인원 도구 모음
        </p>
      </div>

      {/* Tool Card Grid */}
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4 stagger-enter">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              role="button"
              tabIndex={0}
              className="group flex cursor-pointer flex-col items-start gap-2.5 rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
              style={{ borderLeftColor: tool.accentColor, borderLeftWidth: 3 }}
              onClick={() => onNavigate?.(tool.id)}
              onKeyDown={(e) => { if (e.key === "Enter") onNavigate?.(tool.id); }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${tool.accentColor}20` }}
              >
                <Icon
                  className="h-4.5 w-4.5"
                  style={{ color: tool.accentColor }}
                />
              </div>
              <div>
                <span className="text-sm font-medium leading-none">{tool.label}</span>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
