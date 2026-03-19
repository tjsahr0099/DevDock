import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGroupRef } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import FileTree, { type FileNode } from "@/components/FileTree";
import EmptyState from "@/components/EmptyState";
import {
  FolderOpen,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Maximize2,
  FileImage,
} from "lucide-react";
import TabPage from "@/components/TabPage";
import { useSettingsStore } from "@/stores/settingsStore";

export default function PumlViewer() {
  const groupRef = useGroupRef();
  const { settings, saveSettings } = useSettingsStore();
  const [folderPath, setFolderPath] = useState(settings.pumlViewerFolderPath || "");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [sourceVisible, setSourceVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [statusMessage, setStatusMessage] = useState("폴더를 선택하세요");
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const loadTree = useCallback(async (path: string) => {
    if (!path) return;
    try {
      const tree = await invoke<FileNode[]>("list_directory", {
        path,
        extensions: ["puml", "plantuml", "pu", "wsd"],
      });
      setFileTree(tree);
      setStatusMessage(`${path}`);
    } catch (e) {
      setStatusMessage(`폴더 로드 실패: ${e}`);
      setFileTree([]);
    }
  }, []);

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      const path = selected as string;
      setFolderPath(path);
      setSelectedFile(null);
      setSvgContent("");
      setSourceCode("");
      loadTree(path);
      saveSettings({ pumlViewerFolderPath: path });
    }
  }, [loadTree, saveSettings]);

  const handleRefresh = useCallback(() => {
    if (folderPath) {
      loadTree(folderPath);
    }
  }, [folderPath, loadTree]);

  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    setLoading(true);
    setSvgContent("");

    try {
      const source = await invoke<string>("read_text_file", { path });
      setSourceCode(source);

      const svg = await invoke<string>("render_puml_svg", { source });
      setSvgContent(svg);
      setZoom(100);

      const name = path.split("/").pop() ?? path;
      setStatusMessage(`${name} - 렌더링 완료`);
    } catch (e) {
      setStatusMessage(`렌더링 실패: ${e}`);
      setSvgContent("");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 25, 400));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 25, 25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  const handleFitWidth = useCallback(() => {
    if (!svgContainerRef.current) return;
    const container = svgContainerRef.current;
    const svg = container.querySelector("svg");
    if (!svg) return;
    const containerWidth = container.clientWidth - 32;
    const svgWidth = svg.getAttribute("width")
      ? parseFloat(svg.getAttribute("width")!)
      : svg.getBoundingClientRect().width;
    if (svgWidth > 0) {
      setZoom(Math.round((containerWidth / svgWidth) * 100));
    }
  }, []);

  useEffect(() => {
    if (folderPath) {
      loadTree(folderPath);
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      groupRef.current?.setLayout({ "puml-tree": 15, "puml-preview": 85 });
    });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoom((z) => Math.min(z + 10, 400));
        } else {
          setZoom((z) => Math.max(z - 10, 25));
        }
      }
    },
    [],
  );

  // Breadcrumb from selected file path
  const breadcrumb = selectedFile
    ? selectedFile.replace(/\\/g, "/").split("/").slice(-3).join(" / ")
    : null;

  return (
    <TabPage
      helpKey="pumlviewer"
      toolbar={
        <>
          <Input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                loadTree(folderPath);
                saveSettings({ pumlViewerFolderPath: folderPath });
              }
            }}
            placeholder="PlantUML 폴더 경로"
            className="h-7 flex-1 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleBrowse}>
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            찾아보기
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </>
      }
      statusBar={<span className="text-xs text-muted-foreground">{statusMessage}</span>}
    >

      <ResizablePanelGroup groupRef={groupRef} orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel id="puml-tree" defaultSize="15" minSize="10" maxSize="30">
          <FileTree
            nodes={fileTree}
            selectedPath={selectedFile}
            onSelect={handleSelectFile}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="puml-preview" defaultSize="85">
          <div className="flex h-full flex-col">
            {/* Zoom controls + breadcrumb */}
            <div className="flex items-center gap-1 border-b border-border px-3 py-1">
              {breadcrumb && (
                <span className="mr-2 truncate text-xs text-muted-foreground">
                  {breadcrumb}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[3rem] text-center text-xs text-muted-foreground tabular-nums">
                  {zoom}%
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleZoomReset}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleFitWidth}
                  title="너비 맞춤"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                {loading && (
                  <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* SVG display */}
            <ScrollArea className="flex-1">
              <div
                ref={svgContainerRef}
                className="min-h-full bg-checkerboard p-4"
                onWheel={handleWheel}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3 pt-12">
                    <Skeleton className="h-48 w-64 rounded-lg" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                ) : svgContent ? (
                  <div
                    className="inline-block origin-top-left animate-fade-in"
                    style={{ transform: `scale(${zoom / 100})` }}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />
                ) : (
                  <EmptyState
                    icon={FileImage}
                    title={folderPath ? "파일을 선택하세요" : "폴더를 선택하세요"}
                    description={
                      folderPath
                        ? "좌측 트리에서 PlantUML 파일을 선택하면 렌더링됩니다"
                        : "폴더를 선택하면 PlantUML 파일을 미리볼 수 있습니다"
                    }
                  />
                )}
              </div>
            </ScrollArea>

            {/* Source code collapsible */}
            {sourceCode && (
              <div className="border-t border-border">
                <button
                  className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
                  onClick={() => setSourceVisible(!sourceVisible)}
                >
                  {sourceVisible ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  PlantUML 소스 코드
                </button>
                {sourceVisible && (
                  <ScrollArea className="max-h-48">
                    <pre className="bg-muted p-3 text-xs">
                      <code>{sourceCode}</code>
                    </pre>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </TabPage>
  );
}
