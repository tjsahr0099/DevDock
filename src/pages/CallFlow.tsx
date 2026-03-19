import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGroupRef } from "react-resizable-panels";
import EmptyState from "@/components/EmptyState";
import {
  FolderOpen,
  Search,
  Loader2,
  ChevronRight,
  ChevronDown,
  FileCode,
  Network,
  Clock,
  Copy,
  Save,
  ZoomIn,
  ZoomOut,
  GitBranch,
  Filter,
} from "lucide-react";
import TabPage from "@/components/TabPage";

interface MethodCall {
  target_field: string;
  target_class: string;
  target_method: string;
  call_type: string;
}

interface MethodMetadata {
  method_name: string;
  return_type: string;
  parameters: string[];
  annotations: string[];
  is_endpoint: boolean;
  http_method: string;
  request_path: string;
  is_scheduled: boolean;
  cron_expression: string;
  method_calls: MethodCall[];
  javadoc: string;
}

interface ClassMetadata {
  package_name: string;
  class_name: string;
  full_name: string;
  class_type: string;
  annotations: string[];
  methods: MethodMetadata[];
  injected_fields: Record<string, string>;
  base_path: string;
}

interface AnalysisResult {
  classes: ClassMetadata[];
  errors: string[];
}

interface TreeNode {
  label: string;
  node_type: string;
  class_name: string | null;
  method_name: string | null;
  children: TreeNode[];
}

function TreeItem({
  node,
  onSelect,
  selectedKey,
  filterText,
}: {
  node: TreeNode;
  onSelect: (className: string, methodName: string) => void;
  selectedKey: string;
  filterText: string;
}) {
  const [expanded, setExpanded] = useState(
    node.node_type === "root" || node.node_type === "category",
  );
  const hasChildren = node.children.length > 0;
  const isMethod = node.node_type === "method";
  const itemKey =
    isMethod && node.class_name && node.method_name
      ? `${node.class_name}::${node.method_name}`
      : "";
  const isSelected = isMethod && itemKey === selectedKey;

  // Filter: if filterText is set, only show matching items
  const matchesFilter = filterText === "" ||
    node.label.toLowerCase().includes(filterText.toLowerCase());

  const childrenMatch = node.children.some((child) =>
    filterText === "" ||
    child.label.toLowerCase().includes(filterText.toLowerCase()) ||
    child.children.some((gc) => gc.label.toLowerCase().includes(filterText.toLowerCase()))
  );

  if (filterText && !matchesFilter && !childrenMatch) return null;

  const handleClick = () => {
    if (isMethod && node.class_name && node.method_name) {
      onSelect(node.class_name, node.method_name);
    } else if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  const isExpanded = filterText ? true : expanded;

  const icon = () => {
    if (node.node_type === "category") {
      return node.label.includes("API") ? (
        <Network className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Clock className="h-3.5 w-3.5 text-orange-500" />
      );
    }
    if (node.node_type === "class") {
      return <FileCode className="h-3.5 w-3.5 text-blue-500" />;
    }
    if (isMethod) {
      return (
        <Badge variant="outline" className="h-3.5 px-1 text-[8px] leading-none text-purple-500 border-purple-500/30">
          M
        </Badge>
      );
    }
    return null;
  };

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-accent ${isSelected ? "bg-accent font-medium" : ""}`}
        style={{
          paddingLeft: node.node_type === "root" ? 4 : undefined,
        }}
        onClick={handleClick}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {icon()}
        <span className="truncate">{node.label}</span>
      </div>
      {isExpanded && hasChildren && (
        <div className="ml-3 border-l border-border pl-1">
          {node.children.map((child, i) => (
            <TreeItem
              key={`${child.label}-${i}`}
              node={child}
              onSelect={onSelect}
              selectedKey={selectedKey}
              filterText={filterText}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CallFlow() {
  const groupRef = useGroupRef();
  const [projectPath, setProjectPath] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [pumlCode, setPumlCode] = useState("");
  const [svgContent, setSvgContent] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [generatingDiagram, setGeneratingDiagram] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [treeFilter, setTreeFilter] = useState("");

  const handleBrowse = async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setProjectPath(selected as string);
      invoke("get_settings")
        .then((json) => {
          try {
            const data = JSON.parse(json as string);
            data.callFlowProjectPath = selected;
            return invoke("save_settings", {
              json: JSON.stringify(data),
            });
          } catch {
            return invoke("save_settings", {
              json: JSON.stringify({ callFlowProjectPath: selected }),
            });
          }
        })
        .catch(() => {});
    }
  };

  useState(() => {
    invoke<string>("get_settings")
      .then((json) => {
        try {
          const data = JSON.parse(json);
          if (data.callFlowProjectPath) {
            setProjectPath(data.callFlowProjectPath);
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  });

  const handleAnalyze = useCallback(async () => {
    if (!projectPath) return;
    setAnalyzing(true);
    setStatusMsg("프로젝트 분석 중...");
    setAnalysisResult(null);
    setTree(null);
    setPumlCode("");
    setSvgContent("");
    setSelectedKey("");

    try {
      const result = await invoke<AnalysisResult>("analyze_project", {
        projectPath,
      });
      setAnalysisResult(result);

      const treeData = await invoke<TreeNode>("build_analysis_tree", {
        result,
      });
      setTree(treeData);

      const controllers = result.classes.filter(
        (c) => c.class_type === "CONTROLLER",
      ).length;
      const services = result.classes.filter(
        (c) => c.class_type === "SERVICE",
      ).length;
      const endpoints = result.classes.reduce(
        (sum, c) => sum + c.methods.filter((m) => m.is_endpoint).length,
        0,
      );
      const scheduled = result.classes.reduce(
        (sum, c) => sum + c.methods.filter((m) => m.is_scheduled).length,
        0,
      );

      setStatusMsg(
        `분석 완료: ${result.classes.length}개 클래스, ${controllers} Controllers, ${services} Services, ${endpoints} Endpoints, ${scheduled} Scheduled${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ""}`,
      );
    } catch (e) {
      setStatusMsg(`분석 실패: ${e}`);
    } finally {
      setAnalyzing(false);
    }
  }, [projectPath]);

  useEffect(() => {
    requestAnimationFrame(() => {
      groupRef.current?.setLayout({ "cf-tree": 15, "cf-diagram": 85 });
    });
  }, []);

  const handleSelectMethod = useCallback(
    async (className: string, methodName: string) => {
      if (!analysisResult) return;
      const key = `${className}::${methodName}`;
      setSelectedKey(key);
      setGeneratingDiagram(true);
      setPumlCode("");
      setSvgContent("");

      try {
        const puml = await invoke<string>("generate_sequence_diagram", {
          result: analysisResult,
          className,
          methodName,
        });
        setPumlCode(puml);

        try {
          const svg = await invoke<string>("render_puml_svg", {
            pumlCode: puml,
          });
          setSvgContent(svg);
        } catch {
          setSvgContent("");
        }
      } catch (e) {
        setPumlCode(`// Error: ${e}`);
      } finally {
        setGeneratingDiagram(false);
      }
    },
    [analysisResult],
  );

  const handleCopyPuml = () => {
    navigator.clipboard.writeText(pumlCode);
  };

  const handleSavePuml = async () => {
    const selected = await open({
      directory: true,
    });
    if (selected) {
      const fileName = selectedKey.split("::").pop() || "diagram";
      const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = `${selected}/${safeName}.puml`;
      try {
        await invoke("save_text_file", { path: filePath, content: pumlCode });
      } catch {
        // ignore
      }
    }
  };

  return (
    <TabPage
      helpKey="callflow"
      toolbar={
        <>
          <Input
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="Java 프로젝트 경로를 선택하세요"
            className="h-7 flex-1 text-xs"
            readOnly
          />
          <Button size="sm" variant="outline" onClick={handleBrowse}>
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            찾아보기
          </Button>
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={!projectPath || analyzing}
          >
            {analyzing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1 h-3.5 w-3.5" />
            )}
            분석
          </Button>
        </>
      }
      statusBar={<span className="text-xs text-muted-foreground">{statusMsg}</span>}
    >

      <ResizablePanelGroup groupRef={groupRef} orientation="horizontal" className="flex-1 min-h-0">
        {/* Left: Analysis Tree */}
        <ResizablePanel id="cf-tree" defaultSize="15" minSize="10" maxSize="30">
          <div className="flex h-full flex-col">
            {/* Tree search filter */}
            {tree && (
              <div className="border-b border-border px-2 py-1.5">
                <div className="relative">
                  <Filter className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={treeFilter}
                    onChange={(e) => setTreeFilter(e.target.value)}
                    placeholder="클래스/메서드 검색..."
                    className="h-6 pl-7 text-xs"
                  />
                </div>
              </div>
            )}
            <ScrollArea className="flex-1">
              <div className="p-2">
                {tree ? (
                  tree.children.map((child, i) => (
                    <TreeItem
                      key={i}
                      node={child}
                      onSelect={handleSelectMethod}
                      selectedKey={selectedKey}
                      filterText={treeFilter}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={GitBranch}
                    title={analyzing ? "분석 중..." : "프로젝트를 분석하세요"}
                    description="1. 프로젝트 선택 → 2. 분석 → 3. 메서드 선택"
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Diagram */}
        <ResizablePanel id="cf-diagram" defaultSize="85" minSize="30">
          <div className="flex h-full flex-col">
            {/* Diagram toolbar */}
            {pumlCode && (
              <div className="flex items-center gap-1 border-b border-border px-2 py-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setZoom(Math.min(zoom + 20, 300))}
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setZoom(Math.max(zoom - 20, 20))}
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">{zoom}%</span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowCode(!showCode)}
                >
                  <FileCode className="mr-1 h-3 w-3" />
                  {showCode ? "코드 숨기기" : "코드 보기"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={handleCopyPuml}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  복사
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={handleSavePuml}
                >
                  <Save className="mr-1 h-3 w-3" />
                  저장
                </Button>
              </div>
            )}

            {/* Diagram view */}
            <ScrollArea className="flex-1">
              {generatingDiagram ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : svgContent ? (
                <div className="bg-checkerboard p-4">
                  <div
                    className="animate-fade-in"
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: "top left",
                    }}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />
                </div>
              ) : pumlCode && !svgContent ? (
                <div className="p-4">
                  <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                    {pumlCode}
                  </pre>
                </div>
              ) : (
                <EmptyState
                  icon={GitBranch}
                  title="좌측 트리에서 메서드를 선택하세요"
                  description="시퀀스 다이어그램이 생성됩니다"
                />
              )}
            </ScrollArea>

            {/* Code panel */}
            {showCode && pumlCode && (
              <div className="border-t border-border">
                <ScrollArea className="max-h-48">
                  <pre className="whitespace-pre-wrap bg-muted p-3 font-mono text-xs">
                    {pumlCode}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </TabPage>
  );
}
