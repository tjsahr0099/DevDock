import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import TabPage from "@/components/TabPage";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { DotSpinner } from "@/components/Spinner";
import PathInputWithHistory from "@/components/RecentPathsMenu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen,
  RefreshCw,
  GitBranch,
  History,
  ChevronRight,
  ChevronDown,
  FileIcon,
  FolderIcon,
} from "lucide-react";

/* ── Types ── */
interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
  commit_hash: string;
}

interface CommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  date_str: string;
  parents: string[];
}

interface DiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffFile {
  path: string;
  status: string;
  old_path: string | null;
  hunks: DiffHunk[];
}

/* ── Graph computation ── */
const GRAPH_COLORS = [
  "hsl(210 90% 60%)",
  "hsl(150 70% 50%)",
  "hsl(340 80% 60%)",
  "hsl(40 90% 55%)",
  "hsl(270 70% 60%)",
  "hsl(180 70% 45%)",
  "hsl(20 85% 55%)",
  "hsl(300 60% 55%)",
];

interface GraphRow {
  col: number;
  // Segments: lines connecting (fromCol, thisRow) → (toCol, nextRow)
  segments: { fromCol: number; toCol: number; color: string }[];
}

function computeGraph(commits: CommitInfo[]): { rows: GraphRow[]; maxCols: number } {
  if (commits.length === 0) return { rows: [], maxCols: 0 };

  const rows: GraphRow[] = [];
  let lanes: (string | null)[] = [];
  let maxCols = 0;

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];

    // Find lane for this commit
    let col = lanes.indexOf(commit.hash);
    if (col === -1) {
      col = lanes.indexOf(null);
      if (col === -1) {
        col = lanes.length;
        lanes.push(commit.hash);
      } else {
        lanes[col] = commit.hash;
      }
    }

    const segments: GraphRow["segments"] = [];

    // Pass-through: lanes that continue (not this commit)
    for (let j = 0; j < lanes.length; j++) {
      if (j !== col && lanes[j] !== null) {
        segments.push({
          fromCol: j,
          toCol: j,
          color: GRAPH_COLORS[j % GRAPH_COLORS.length],
        });
      }
    }

    // Clear this lane
    lanes[col] = null;

    // Place parents
    if (commit.parents.length > 0) {
      // First parent → same lane
      lanes[col] = commit.parents[0];
      segments.push({
        fromCol: col,
        toCol: col,
        color: GRAPH_COLORS[col % GRAPH_COLORS.length],
      });

      // Merge parents → find or create lanes
      for (let p = 1; p < commit.parents.length; p++) {
        const parentHash = commit.parents[p];
        const existing = lanes.indexOf(parentHash);
        if (existing !== -1) {
          segments.push({
            fromCol: col,
            toCol: existing,
            color: GRAPH_COLORS[existing % GRAPH_COLORS.length],
          });
        } else {
          let slot = lanes.indexOf(null);
          if (slot === -1) {
            slot = lanes.length;
            lanes.push(parentHash);
          } else {
            lanes[slot] = parentHash;
          }
          segments.push({
            fromCol: col,
            toCol: slot,
            color: GRAPH_COLORS[slot % GRAPH_COLORS.length],
          });
        }
      }
    }

    // Trim trailing nulls
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
    }

    maxCols = Math.max(maxCols, lanes.length, col + 1);
    rows.push({ col, segments });
  }

  return { rows, maxCols };
}

/* ── Graph + Commit list (single scrollable area) ── */
const CELL_W = 14;
const ROW_H = 52;
const DOT_R = 4;

/* ── Changed files tree ── */
interface FileTreeNode {
  name: string;
  path: string;
  status?: string;
  children: FileTreeNode[];
}

function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      let existing = current.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: isFile ? file.path : parts.slice(0, i + 1).join("/"),
          status: isFile ? file.status : undefined,
          children: [],
        };
        current.push(existing);
      }
      if (isFile) existing.status = file.status;
      current = existing.children;
    }
  }
  return root;
}

function ChangedFileTree({
  nodes,
  selectedFile,
  onSelect,
  depth = 0,
}: {
  nodes: FileTreeNode[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const statusColor = (s?: string) => {
    switch (s) {
      case "Added": return "text-green-500";
      case "Deleted": return "text-red-500";
      case "Modified": return "text-yellow-500";
      case "Renamed": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  const statusLabel = (s?: string) => {
    switch (s) {
      case "Added": return "A";
      case "Deleted": return "D";
      case "Modified": return "M";
      case "Renamed": return "R";
      default: return "";
    }
  };

  return (
    <>
      {nodes.map((node) => {
        const isDir = node.children.length > 0;
        const isCollapsed = collapsed.has(node.path);
        const isSelected = selectedFile === node.path;
        return (
          <div key={node.path}>
            <div
              className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 text-xs ${
                isSelected ? "bg-accent" : ""
              }`}
              style={{ paddingLeft: depth * 14 + 8 }}
              onClick={() => {
                if (isDir) toggle(node.path);
                else onSelect(node.path);
              }}
            >
              {isDir ? (
                isCollapsed ? (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="w-3" />
              )}
              {isDir ? (
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate flex-1">{node.name}</span>
              {node.status && (
                <span className={`font-mono text-[10px] font-bold ${statusColor(node.status)}`}>
                  {statusLabel(node.status)}
                </span>
              )}
            </div>
            {isDir && !isCollapsed && (
              <ChangedFileTree
                nodes={node.children}
                selectedFile={selectedFile}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Main component ── */
export default function GitHistory() {
  const { settings, saveSettings } = useSettingsStore();
  const [repoPath, setRepoPath] = useState(settings.gitHistoryRepoPath || "");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [fileViewMode, setFileViewMode] = useState<"tree" | "flat">("tree");
  const diffScrollRef = useRef<HTMLDivElement>(null);

  const graphData = useMemo(() => computeGraph(commits), [commits]);
  const fileTree = useMemo(() => buildFileTree(diffFiles), [diffFiles]);

  // Map commit hash → branch names
  const commitBranchMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of branches) {
      const existing = map.get(b.commit_hash) || [];
      existing.push(b.name + (b.is_head ? " (HEAD)" : ""));
      map.set(b.commit_hash, existing);
    }
    return map;
  }, [branches]);

  const loadCommits = useCallback(
    async (path: string, branch: string) => {
      setLoading(true);
      setStatusMsg("커밋 로그 조회 중...");
      try {
        const commitList = await invoke<CommitInfo[]>("git_get_commits", {
          repoPath: path,
          branchName: branch,
          limit: 200,
        });
        setCommits(commitList);
        setSelectedCommit(null);
        setDiffFiles([]);
        setStatusMsg(`${commitList.length}개 커밋`);
      } catch (e) {
        setStatusMsg(`오류: ${e}`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadRepo = useCallback(
    async (path: string) => {
      if (!path) return;
      setRepoPath(path);
      // Save current + update recent paths (max 10, dedup, most recent first)
      const recent = settings.gitHistoryRecentPaths || [];
      const updated = [path, ...recent.filter((p) => p !== path)].slice(0, 10);
      saveSettings({ gitHistoryRepoPath: path, gitHistoryRecentPaths: updated });
      setLoading(true);
      setStatusMsg("브랜치 목록 조회 중...");
      try {
        const branchList = await invoke<BranchInfo[]>("git_list_branches", {
          repoPath: path,
        });
        setBranches(branchList);
        setCommits([]);
        setDiffFiles([]);
        setSelectedCommit(null);
        const headBranch = branchList.find((b) => b.is_head);
        if (headBranch) {
          setSelectedBranch(headBranch.name);
          await loadCommits(path, headBranch.name);
        }
        setStatusMsg(`${branchList.length}개 브랜치 발견`);
      } catch (e) {
        setStatusMsg(`오류: ${e}`);
        setBranches([]);
      } finally {
        setLoading(false);
      }
    },
    [loadCommits, saveSettings],
  );

  // settings 로드 후 경로 동기화
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const path = settings.gitHistoryRepoPath;
    if (!path) return;
    initializedRef.current = true;
    setRepoPath(path);
    // 히스토리 마이그레이션
    if (!settings.gitHistoryRecentPaths?.includes(path)) {
      const recent = settings.gitHistoryRecentPaths || [];
      saveSettings({ gitHistoryRecentPaths: [path, ...recent].slice(0, 10) });
    }
    loadRepo(path);
  }, [settings.gitHistoryRepoPath]);

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      loadRepo(selected as string);
    }
  }, [loadRepo]);

  const handleRefresh = useCallback(() => {
    if (repoPath) loadRepo(repoPath);
  }, [repoPath, loadRepo]);

  const handleBranchChange = useCallback(
    async (branch: string) => {
      setSelectedBranch(branch);
      await loadCommits(repoPath, branch);
    },
    [repoPath, loadCommits],
  );

  const handleCommitClick = useCallback(
    async (hash: string) => {
      setSelectedCommit(hash);
      setSelectedDiffFile(null);
      setDiffLoading(true);
      try {
        const files = await invoke<DiffFile[]>("git_get_diff", {
          repoPath,
          commitHash: hash,
        });
        setDiffFiles(files);
      } catch (e) {
        setDiffFiles([]);
        setStatusMsg(`Diff 오류: ${e}`);
      } finally {
        setDiffLoading(false);
      }
    },
    [repoPath],
  );

  const handleFileTreeSelect = useCallback((path: string) => {
    setSelectedDiffFile(path);
    const el = diffScrollRef.current?.querySelector(
      `[data-file-path="${CSS.escape(path)}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const toolbar = (
    <>
      <PathInputWithHistory
        value={repoPath}
        onChange={setRepoPath}
        onSubmit={loadRepo}
        recentPaths={settings.gitHistoryRecentPaths || []}
        onSelect={loadRepo}
        placeholder="Git 저장소 경로"
      />
      <Button size="sm" variant="outline" onClick={handleBrowse}>
        <FolderOpen className="mr-1 h-3.5 w-3.5" />
        찾아보기
      </Button>
      <Button size="sm" variant="outline" onClick={handleRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
      {loading && branches.length === 0 && repoPath && (
        <Skeleton className="w-[200px] h-8 rounded-md" />
      )}
      {branches.length > 0 && (
        <Select value={selectedBranch} onValueChange={handleBranchChange}>
          <SelectTrigger size="sm" className="w-[200px] text-xs">
            <GitBranch className="h-3 w-3 mr-1" />
            <SelectValue placeholder="브랜치 선택" />
          </SelectTrigger>
          <SelectContent>
            {localBranches.map((b) => (
              <SelectItem key={b.name} value={b.name}>
                {b.name} {b.is_head && "(HEAD)"}
              </SelectItem>
            ))}
            {remoteBranches.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-muted-foreground">리모트</div>
                {remoteBranches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      )}
    </>
  );

  return (
    <TabPage
      helpKey="githistory"
      toolbar={toolbar}
      statusBar={<span className="text-xs text-muted-foreground">{statusMsg}</span>}
    >
      {!repoPath ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={History}
            title="프로젝트 폴더를 선택하세요"
            description="Git 저장소의 브랜치와 커밋 히스토리를 조회합니다"
          />
        </div>
      ) : (
        <ResizablePanelGroup
          orientation="vertical"
          className="flex-1 min-h-0"
        >
          {/* ── Top: Commit graph + list ── */}
          <ResizablePanel id="git-top" defaultSize="50%" minSize="20%">
            {loading && commits.length === 0 ? (
              <div className="flex h-full min-h-0">
                {/* Graph skeleton */}
                <div className="w-[220px] border-r border-border min-h-0 flex flex-col">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center px-3"
                      style={{ height: ROW_H }}
                    >
                      <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                      {i < 7 && (
                        <div className="absolute ml-[5px] mt-[52px]">
                          <Skeleton className="w-0.5 h-6" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Commit list skeleton */}
                <div className="flex-1 min-h-0 flex flex-col">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="px-3 flex flex-col justify-center border-b border-border"
                      style={{ height: ROW_H }}
                    >
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-[18px] w-14 rounded" />
                        <Skeleton className="h-4 w-[60%]" />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div className="flex h-full min-h-0">
              {/* Graph column */}
              <div className="w-[220px] border-r border-border min-h-0 shrink-0">
                <ScrollArea className="h-full">
                  <svg
                    width={220}
                    height={commits.length * ROW_H}
                    className="block"
                  >
                    {graphData.rows.map((row, idx) => {
                      const cy = idx * ROW_H + ROW_H / 2;
                      const nextCy = (idx + 1) * ROW_H + ROW_H / 2;
                      const c = commits[idx];
                      const branchNames = commitBranchMap.get(c.hash);
                      const tooltipLines = [
                        c.short_hash,
                        ...(branchNames ? [`Branch: ${branchNames.join(", ")}`] : []),
                        c.author,
                        c.date_str,
                        c.message.split("\n")[0],
                        ...(c.parents.length > 1 ? ["Merge commit"] : []),
                      ];
                      const tooltip = tooltipLines.join("\n");
                      return (
                        <g key={idx}>
                          {row.segments.map((seg, si) => (
                            <line
                              key={si}
                              x1={seg.fromCol * CELL_W + CELL_W / 2 + 10}
                              y1={cy}
                              x2={seg.toCol * CELL_W + CELL_W / 2 + 10}
                              y2={nextCy}
                              stroke={seg.color}
                              strokeWidth={2}
                              strokeOpacity={0.7}
                            />
                          ))}
                          {/* Hover target (larger invisible circle) */}
                          <circle
                            cx={row.col * CELL_W + CELL_W / 2 + 10}
                            cy={cy}
                            r={DOT_R + 6}
                            fill="transparent"
                            className="cursor-pointer"
                          >
                            <title>{tooltip}</title>
                          </circle>
                          <circle
                            cx={row.col * CELL_W + CELL_W / 2 + 10}
                            cy={cy}
                            r={DOT_R}
                            fill={GRAPH_COLORS[row.col % GRAPH_COLORS.length]}
                            stroke="var(--background)"
                            strokeWidth={2}
                            className="pointer-events-none"
                          />
                          {commits[idx].parents.length > 1 && (
                            <circle
                              cx={row.col * CELL_W + CELL_W / 2 + 10}
                              cy={cy}
                              r={DOT_R + 2}
                              fill="none"
                              stroke={GRAPH_COLORS[row.col % GRAPH_COLORS.length]}
                              strokeWidth={1.5}
                              strokeOpacity={0.5}
                              className="pointer-events-none"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </ScrollArea>
              </div>
              {/* Commit list */}
              <ScrollArea className="flex-1 min-h-0">
                {commits.map((c) => {
                  const isSelected = selectedCommit === c.hash;
                  const branchTags = commitBranchMap.get(c.hash);
                  return (
                    <div
                      key={c.hash}
                      className={`px-3 cursor-pointer border-b border-border hover:bg-accent/50 flex items-center ${
                        isSelected ? "bg-accent" : ""
                      }`}
                      style={{ height: ROW_H }}
                      onClick={() => handleCommitClick(c.hash)}
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                            {c.short_hash}
                          </Badge>
                          {branchTags && branchTags.map((tag) => (
                            <Badge key={tag} className="text-[9px] shrink-0 px-1.5 py-0 h-4 bg-primary/15 text-primary border-primary/30">
                              {tag}
                            </Badge>
                          ))}
                          <span className="text-sm truncate flex-1">
                            {c.message.split("\n")[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{c.author}</span>
                          <span className="text-[11px] text-muted-foreground">{c.date_str}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ── Bottom: Changed file tree + Diff viewer ── */}
          <ResizablePanel id="git-bottom" defaultSize="50%" minSize="20%">
            <div className="flex h-full min-h-0">
              {diffLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <DotSpinner label="변경 내용 로딩 중..." />
                </div>
              ) : diffFiles.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState
                    icon={History}
                    title="커밋을 선택하면 변경 내용을 표시합니다"
                  />
                </div>
              ) : (
                <>
                  {/* Changed files - same width as graph column */}
                  <div className="w-[220px] border-r border-border flex flex-col min-h-0 shrink-0">
                    <div className="px-2 py-1 flex items-center justify-between border-b border-border">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        변경 파일 ({diffFiles.length})
                      </span>
                      <div className="flex gap-0.5">
                        <button
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            fileViewMode === "tree"
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => setFileViewMode("tree")}
                        >
                          트리
                        </button>
                        <button
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            fileViewMode === "flat"
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => setFileViewMode("flat")}
                        >
                          목록
                        </button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      {fileViewMode === "tree" ? (
                        <ChangedFileTree
                          nodes={fileTree}
                          selectedFile={selectedDiffFile}
                          onSelect={handleFileTreeSelect}
                        />
                      ) : (
                        diffFiles.map((file) => {
                          const statusColor =
                            file.status === "Added" ? "text-green-500" :
                            file.status === "Deleted" ? "text-red-500" :
                            file.status === "Modified" ? "text-yellow-500" :
                            file.status === "Renamed" ? "text-blue-500" :
                            "text-muted-foreground";
                          const statusLabel =
                            file.status === "Added" ? "A" :
                            file.status === "Deleted" ? "D" :
                            file.status === "Modified" ? "M" :
                            file.status === "Renamed" ? "R" : "";
                          const isSelected = selectedDiffFile === file.path;
                          return (
                            <div
                              key={file.path}
                              className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 text-xs ${
                                isSelected ? "bg-accent" : ""
                              }`}
                              onClick={() => handleFileTreeSelect(file.path)}
                            >
                              <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate flex-1">{file.path}</span>
                              <span className={`font-mono text-[10px] font-bold shrink-0 ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </ScrollArea>
                  </div>

                  {/* Diff viewer */}
                  <ScrollArea className="flex-1" ref={diffScrollRef}>
                    {diffFiles.map((file, fi) => (
                      <div
                        key={fi}
                        className="border-b border-border"
                        data-file-path={file.path}
                      >
                        <div className="px-3 py-2 bg-muted/50 flex items-center gap-2 sticky top-0 z-10">
                          <Badge
                            variant={
                              file.status === "Added"
                                ? "default"
                                : file.status === "Deleted"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {file.status === "Added"
                              ? "추가"
                              : file.status === "Deleted"
                                ? "삭제"
                                : file.status === "Renamed"
                                  ? "이름변경"
                                  : "수정"}
                          </Badge>
                          <span className="text-xs font-mono">{file.path}</span>
                          {file.old_path && (
                            <span className="text-[10px] text-muted-foreground">
                              &larr; {file.old_path}
                            </span>
                          )}
                        </div>
                        {file.hunks.map((hunk, hi) => (
                          <div key={hi}>
                            <div className="px-3 py-1 text-[11px] text-blue-500 bg-blue-500/5 font-mono">
                              {hunk.header.trim()}
                            </div>
                            <pre className="text-xs font-mono">
                              {hunk.lines.map((line, li) => (
                                <div
                                  key={li}
                                  className={`px-3 ${
                                    line.origin === "+"
                                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                      : line.origin === "-"
                                        ? "bg-red-500/10 text-red-700 dark:text-red-400"
                                        : ""
                                  }`}
                                >
                                  <span className="inline-block w-10 text-right text-muted-foreground mr-2 select-none">
                                    {line.old_lineno ?? ""}
                                  </span>
                                  <span className="inline-block w-10 text-right text-muted-foreground mr-2 select-none">
                                    {line.new_lineno ?? ""}
                                  </span>
                                  <span className="select-none mr-1">{line.origin}</span>
                                  {line.content}
                                </div>
                              ))}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ))}
                  </ScrollArea>
                </>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </TabPage>
  );
}
