import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGroupRef } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import FileTree, { type FileNode } from "@/components/FileTree";
import EmptyState from "@/components/EmptyState";
import PathInputWithHistory from "@/components/RecentPathsMenu";
import {
  FolderOpen,
  RefreshCw,
  FolderOpenDot,
  FileDown,
  Loader2,
  FileText,
} from "lucide-react";
import TabPage from "@/components/TabPage";
import { useSettingsStore } from "@/stores/settingsStore";

export default function MdViewer() {
  const groupRef = useGroupRef();
  const { settings, saveSettings } = useSettingsStore();
  const [folderPath, setFolderPath] = useState(settings.mdViewerFolderPath || "");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("폴더를 선택하세요");
  const [pdfExporting, setPdfExporting] = useState(false);

  const loadTree = useCallback(async (path: string) => {
    if (!path) return;
    try {
      const tree = await invoke<FileNode[]>("list_directory", {
        path,
        extensions: ["md", "markdown"],
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
      setContent("");
      setFileName("");
      loadTree(path);
      const recent = settings.mdViewerRecentPaths || [];
      const updated = [path, ...recent.filter((p) => p !== path)].slice(0, 10);
      saveSettings({ mdViewerFolderPath: path, mdViewerRecentPaths: updated });
    }
  }, [loadTree, saveSettings, settings.mdViewerRecentPaths]);

  const handleRefresh = useCallback(() => {
    if (folderPath) {
      loadTree(folderPath);
    }
  }, [folderPath, loadTree]);

  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    try {
      const text = await invoke<string>("read_text_file", { path });
      setContent(text);
      const name = path.split("/").pop() ?? path;
      setFileName(name);
      setStatusMessage(path);
    } catch (e) {
      setContent("");
      setStatusMessage(`파일 읽기 실패: ${e}`);
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (selectedFile) {
      try {
        await invoke("open_in_explorer", { path: selectedFile });
      } catch (e) {
        setStatusMessage(`탐색기 열기 실패: ${e}`);
      }
    }
  }, [selectedFile]);

  const handleExportPdf = useCallback(async () => {
    if (!content || !fileName) return;
    try {
      const selected = await save({
        defaultPath: fileName.replace(/\.(md|markdown)$/i, ".pdf"),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;
      setPdfExporting(true);
      setStatusMessage("PDF 변환 중...");
      const pdfPath = await invoke<string>("markdown_to_pdf", {
        content,
        outputPath: selected as string,
      });
      setStatusMessage(`PDF 저장 완료: ${pdfPath}`);
    } catch (e) {
      setStatusMessage(`PDF 변환 실패: ${e}`);
    } finally {
      setPdfExporting(false);
    }
  }, [content, fileName]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const path = settings.mdViewerFolderPath;
    if (!path) return;
    initializedRef.current = true;
    setFolderPath(path);
    if (!settings.mdViewerRecentPaths?.includes(path)) {
      const recent = settings.mdViewerRecentPaths || [];
      saveSettings({ mdViewerRecentPaths: [path, ...recent].slice(0, 10) });
    }
    loadTree(path);
  }, [settings.mdViewerFolderPath]);

  useEffect(() => {
    requestAnimationFrame(() => {
      groupRef.current?.setLayout({ "md-tree": 20, "md-content": 80 });
    });
  }, []);

  // File info display
  const fileSize = content ? `${(new Blob([content]).size / 1024).toFixed(1)} KB` : "";
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <TabPage
      helpKey="mdviewer"
      toolbar={
        <>
          <PathInputWithHistory
            value={folderPath}
            onChange={setFolderPath}
            onSubmit={(v) => {
              loadTree(v);
              const recent = settings.mdViewerRecentPaths || [];
              const updated = [v, ...recent.filter((p) => p !== v)].slice(0, 10);
              saveSettings({ mdViewerFolderPath: v, mdViewerRecentPaths: updated });
            }}
            recentPaths={settings.mdViewerRecentPaths || []}
            onSelect={(v) => {
              setFolderPath(v);
              setSelectedFile(null);
              setContent("");
              setFileName("");
              loadTree(v);
              saveSettings({ mdViewerFolderPath: v });
            }}
            placeholder="마크다운 폴더 경로"
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

      {fileTree.length === 0 && !folderPath ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={FileText}
            title="폴더를 선택하세요"
            description="폴더를 선택하면 마크다운 파일을 미리볼 수 있습니다"
          />
        </div>
      ) : (
      <ResizablePanelGroup
        groupRef={groupRef}
        orientation="horizontal"
        className="flex-1 min-h-0"
      >
        <ResizablePanel id="md-tree" defaultSize="200px" minSize="120px" maxSize="400px">
          <FileTree
            nodes={fileTree}
            selectedPath={selectedFile}
            onSelect={handleSelectFile}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="md-content" defaultSize="1fr">
          <div className="flex h-full flex-col">
            {/* File header */}
            {fileName && (
              <div className="flex items-center justify-between border-b border-border px-3 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {fileSize} &middot; {lineCount}줄
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6"
                    onClick={handleOpenFolder}
                  >
                    <FolderOpenDot className="mr-1 h-3.5 w-3.5" />
                    폴더 열기
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6"
                    onClick={handleExportPdf}
                    disabled={pdfExporting}
                  >
                    {pdfExporting ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="mr-1 h-3.5 w-3.5" />
                    )}
                    PDF 저장
                  </Button>
                </div>
              </div>
            )}

            {/* Markdown content */}
            {content ? (
              <ScrollArea className="flex-1 min-h-0">
                <div className="prose prose-sm dark:prose-invert max-w-none p-6 animate-fade-in">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {content}
                  </Markdown>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 items-center justify-center min-h-0">
                <EmptyState
                  icon={FileText}
                  title="파일을 선택하세요"
                  description="좌측 트리에서 마크다운 파일을 선택하면 미리볼 수 있습니다"
                />
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      )}
    </TabPage>
  );
}
