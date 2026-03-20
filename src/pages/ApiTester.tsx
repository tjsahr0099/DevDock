import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import TabPage from "@/components/TabPage";
import EmptyState from "@/components/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Plus,
  FolderPlus,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  FolderIcon,
  Globe,
  Upload,
  Download,
} from "lucide-react";

/* ── Types ── */
interface ApiHeader {
  key: string;
  value: string;
  enabled: boolean;
}

interface ApiParam {
  key: string;
  value: string;
  enabled: boolean;
}

interface ApiRequestData {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: ApiHeader[];
  params: ApiParam[];
  body: string;
  body_type: string;
}

type ApiItem =
  | { kind: "folder"; id: string; name: string; children: ApiItem[] }
  | ({ kind: "request" } & ApiRequestData);

interface HttpResponse {
  status: number;
  status_text: string;
  headers: ApiHeader[];
  body: string;
  time_ms: number;
  size_bytes: number;
}

/* ── Collection tree helpers ── */
function findItem(items: ApiItem[], id: string): ApiItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.kind === "folder") {
      const found = findItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateItem(items: ApiItem[], id: string, updater: (item: ApiItem) => ApiItem): ApiItem[] {
  return items.map((item) => {
    if (item.id === id) return updater(item);
    if (item.kind === "folder") {
      return { ...item, children: updateItem(item.children, id, updater) };
    }
    return item;
  });
}

function removeItem(items: ApiItem[], id: string): ApiItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => {
      if (item.kind === "folder") {
        return { ...item, children: removeItem(item.children, id) };
      }
      return item;
    });
}

function addToFolder(items: ApiItem[], folderId: string | null, newItem: ApiItem): ApiItem[] {
  if (!folderId) return [...items, newItem];
  return items.map((item) => {
    if (item.id === folderId && item.kind === "folder") {
      return { ...item, children: [...item.children, newItem] };
    }
    if (item.kind === "folder") {
      return { ...item, children: addToFolder(item.children, folderId, newItem) };
    }
    return item;
  });
}

function findParentFolderId(items: ApiItem[], targetId: string): string | null {
  for (const item of items) {
    if (item.kind === "folder") {
      if (item.children.some((c) => c.id === targetId)) return item.id;
      const found = findParentFolderId(item.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

/* ── Method colors ── */
const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-500",
  POST: "text-yellow-500",
  PUT: "text-blue-500",
  PATCH: "text-purple-500",
  DELETE: "text-red-500",
};

/* ── Collection tree component ── */
function CollectionTree({
  items,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onExport,
  depth = 0,
}: {
  items: ApiItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport?: (id: string) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  return (
    <>
      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover py-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
            onClick={() => {
              startRename(contextMenu.id, findItem(items, contextMenu.id)?.name || "");
              setContextMenu(null);
            }}
          >
            이름 변경
          </button>
          {findItem(items, contextMenu.id)?.kind === "folder" && onExport && (
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
              onClick={() => {
                onExport(contextMenu.id);
                setContextMenu(null);
              }}
            >
              <Download className="h-3 w-3" /> Postman 내보내기
            </button>
          )}
          <button
            className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent text-destructive flex items-center gap-2"
            onClick={() => {
              onDelete(contextMenu.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-3 w-3" /> 삭제
          </button>
        </div>
      )}

      {items.map((item) => {
        const isFolder = item.kind === "folder";
        const isCollapsed = collapsed.has(item.id);
        const isSelected = selectedId === item.id;
        const isEditing = editingId === item.id;

        return (
          <div key={item.id}>
            <div
              className={`group flex items-center gap-1 px-1 py-1 cursor-pointer hover:bg-accent/50 text-xs ${
                isSelected ? "bg-accent" : ""
              }`}
              style={{ paddingLeft: depth * 14 + 4 }}
              onClick={() => {
                if (isFolder) toggle(item.id);
                else onSelect(item.id);
              }}
              onDoubleClick={() => startRename(item.id, item.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ id: item.id, x: e.clientX, y: e.clientY });
              }}
            >
              {isFolder ? (
                isCollapsed ? (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="w-3 shrink-0" />
              )}

              {isFolder ? (
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <span
                  className={`text-[9px] font-bold shrink-0 w-7 ${
                    METHOD_COLORS[(item as ApiRequestData).method] || "text-muted-foreground"
                  }`}
                >
                  {(item as ApiRequestData).method.slice(0, 3)}
                </span>
              )}

              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-5 text-xs flex-1"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate flex-1">{item.name || "이름 없음"}</span>
              )}

              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {isFolder && !isCollapsed && (
              <CollectionTree
                items={item.children}
                selectedId={selectedId}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onExport={onExport}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Header editor ── */
/* ── Param editor ── */
function ParamEditor({
  params,
  onChange,
}: {
  params: ApiParam[];
  onChange: (p: ApiParam[]) => void;
}) {
  const add = () =>
    onChange([...params, { key: "", value: "", enabled: true }]);
  const remove = (idx: number) =>
    onChange(params.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<ApiParam>) =>
    onChange(params.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-1 p-2">
      {params.map((p, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={p.enabled}
            onChange={(e) => update(idx, { enabled: e.target.checked })}
            className="h-3 w-3"
          />
          <Input
            value={p.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder="Key"
            className="h-6 text-xs flex-1"
          />
          <Input
            value={p.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="Value"
            className="h-6 text-xs flex-1"
          />
          <button
            onClick={() => remove(idx)}
            className="p-0.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" className="h-6 text-xs w-fit" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> 파라미터 추가
      </Button>
    </div>
  );
}

/* ── Header editor ── */
function HeaderEditor({
  headers,
  onChange,
}: {
  headers: ApiHeader[];
  onChange: (h: ApiHeader[]) => void;
}) {
  const add = () =>
    onChange([...headers, { key: "", value: "", enabled: true }]);
  const remove = (idx: number) =>
    onChange(headers.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<ApiHeader>) =>
    onChange(headers.map((h, i) => (i === idx ? { ...h, ...patch } : h)));

  return (
    <div className="flex flex-col gap-1 p-2">
      {headers.map((h, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={h.enabled}
            onChange={(e) => update(idx, { enabled: e.target.checked })}
            className="h-3 w-3"
          />
          <Input
            value={h.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder="Key"
            className="h-6 text-xs flex-1"
          />
          <Input
            value={h.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="Value"
            className="h-6 text-xs flex-1"
          />
          <button
            onClick={() => remove(idx)}
            className="p-0.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" className="h-6 text-xs w-fit" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> 헤더 추가
      </Button>
    </div>
  );
}

/* ── Main component ── */
export default function ApiTester() {
  const [collection, setCollection] = useState<ApiItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [activeReqTab, setActiveReqTab] = useState<"headers" | "params" | "body">("headers");
  const [activeResTab, setActiveResTab] = useState<"general" | "body" | "headers" | "request" | "cookies">("body");
  const loadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load collections
  useEffect(() => {
    (async () => {
      try {
        const raw = await invoke<string>("get_api_collections");
        const data = JSON.parse(raw);
        setCollection(data.items || []);
      } catch {
        setCollection([]);
      }
      loadedRef.current = true;
    })();
  }, []);

  // Auto-save (debounced)
  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await invoke("save_api_collections", {
        data: JSON.stringify({ items: collection }),
      }).catch(() => {});
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [collection]);

  const selectedItem = selectedId ? findItem(collection, selectedId) : null;
  const selectedRequest =
    selectedItem?.kind === "request" ? (selectedItem as ApiRequestData & { kind: "request" }) : null;

  const syncParamsFromUrl = useCallback(
    (url: string) => {
      if (!selectedId) return;
      try {
        const qIdx = url.indexOf("?");
        if (qIdx === -1) {
          setCollection((prev) =>
            updateItem(prev, selectedId, (item) => ({ ...item, params: [] })),
          );
          return;
        }
        const qs = url.substring(qIdx + 1);
        const parsed = new URLSearchParams(qs);
        const params: ApiParam[] = [];
        parsed.forEach((value, key) => {
          params.push({ key, value, enabled: true });
        });
        setCollection((prev) =>
          updateItem(prev, selectedId, (item) => ({ ...item, params })),
        );
      } catch { /* invalid URL, skip sync */ }
    },
    [selectedId],
  );

  const syncUrlFromParams = useCallback(
    (params: ApiParam[]) => {
      if (!selectedId) return;
      setCollection((prev) => {
        const item = findItem(prev, selectedId);
        if (!item || item.kind !== "request") return prev;
        const currentUrl = item.url;
        const baseUrl = currentUrl.split("?")[0];
        const enabled = params.filter((p) => p.enabled && p.key);
        const newUrl =
          enabled.length > 0
            ? baseUrl +
              "?" +
              enabled
                .map(
                  (p) =>
                    `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`,
                )
                .join("&")
            : baseUrl;
        return updateItem(prev, selectedId, (it) => ({
          ...it,
          params,
          url: newUrl,
        }));
      });
    },
    [selectedId],
  );

  const updateRequest = useCallback(
    (patch: Partial<ApiRequestData>) => {
      if (!selectedId) return;
      setCollection((prev) =>
        updateItem(prev, selectedId, (item) => ({ ...item, ...patch })),
      );
    },
    [selectedId],
  );

  const addRequest = useCallback(
    (folderId: string | null) => {
      const newReq: ApiItem = {
        kind: "request",
        id: crypto.randomUUID(),
        name: "New Request",
        method: "GET",
        url: "",
        headers: [],
        params: [],
        body: "",
        body_type: "json",
      };
      setCollection((prev) => addToFolder(prev, folderId, newReq));
      setSelectedId(newReq.id);
    },
    [],
  );

  const addFolder = useCallback(
    (parentId: string | null) => {
      const newFolder: ApiItem = {
        kind: "folder",
        id: crypto.randomUUID(),
        name: "New Folder",
        children: [],
      };
      setCollection((prev) => addToFolder(prev, parentId, newFolder));
    },
    [],
  );

  const handleRename = useCallback((id: string, name: string) => {
    setCollection((prev) =>
      updateItem(prev, id, (item) => ({ ...item, name })),
    );
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setCollection((prev) => removeItem(prev, id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  const handleExportFolder = useCallback(
    async (folderId: string) => {
      const folder = findItem(collection, folderId);
      if (!folder || folder.kind !== "folder") return;
      const filePath = await save({
        defaultPath: `${folder.name}.postman_collection.json`,
        filters: [{ name: "Postman Collection", extensions: ["json"] }],
      });
      if (!filePath) return;
      const json = exportToPostman(folder.name, folder.children);
      await invoke("save_text_file", { path: filePath as string, content: json });
      setStatusMsg(`내보내기 완료: ${filePath}`);
    },
    [collection],
  );

  const handleImport = useCallback(async () => {
    const filePath = await open({
      filters: [{ name: "Postman Collection", extensions: ["json"] }],
      multiple: false,
    });
    if (!filePath) return;
    try {
      const content = await invoke<string>("read_text_file", { path: filePath as string });
      const json = JSON.parse(content);
      const imported = importFromPostman(json);
      if (imported.length === 0) {
        setStatusMsg("가져올 항목이 없습니다");
        return;
      }
      // Wrap in a folder with the collection name
      const folderName = json.info?.name || "Imported Collection";
      const folder: ApiItem = {
        kind: "folder",
        id: crypto.randomUUID(),
        name: folderName,
        children: imported,
      };
      setCollection((prev) => [...prev, folder]);
      setStatusMsg(`가져오기 완료: ${folderName} (${imported.length}개 항목)`);
    } catch (e) {
      setStatusMsg(`가져오기 실패: ${e}`);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!selectedRequest || !selectedRequest.url) {
      setStatusMsg("URL을 입력하세요");
      return;
    }
    setSending(true);
    setResponse(null);
    setStatusMsg("요청 전송 중...");
    try {
      const res = await invoke<HttpResponse>("send_http_request", {
        method: selectedRequest.method,
        url: selectedRequest.url,
        headers: selectedRequest.headers,
        body: selectedRequest.body,
        bodyType: selectedRequest.body_type,
      });
      setResponse(res);
      setStatusMsg(
        `${res.status} ${res.status_text} — ${res.time_ms}ms — ${formatSize(res.size_bytes)}`,
      );
    } catch (e) {
      setStatusMsg(`오류: ${e}`);
    } finally {
      setSending(false);
    }
  }, [selectedRequest]);

  // Determine parent folder for adding items
  const contextFolderId = selectedId
    ? selectedItem?.kind === "folder"
      ? selectedId
      : findParentFolderId(collection, selectedId)
    : null;

  const toolbar = (
    <>
      <Button size="sm" variant="outline" onClick={() => addFolder(contextFolderId)}>
        <FolderPlus className="mr-1 h-3.5 w-3.5" />
        폴더
      </Button>
      <Button size="sm" variant="outline" onClick={() => addRequest(contextFolderId)}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        요청
      </Button>
      <Button size="sm" variant="outline" onClick={handleImport}>
        <Upload className="mr-1 h-3.5 w-3.5" />
        Postman 가져오기
      </Button>
    </>
  );

  return (
    <TabPage
      helpKey="apitester"
      toolbar={toolbar}
      statusBar={<span className="text-xs text-muted-foreground">{statusMsg}</span>}
    >
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Left: Collection tree */}
        <ResizablePanel id="api-tree" defaultSize="15" minSize="10" maxSize="30">
          <ScrollArea className="h-full">
            {collection.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                <Globe className="h-8 w-8" />
                <span>폴더나 요청을 추가하세요</span>
              </div>
            ) : (
              <CollectionTree
                items={collection}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRename={handleRename}
                onDelete={handleDelete}
                onExport={handleExportFolder}
              />
            )}
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Request + Response */}
        <ResizablePanel id="api-main" defaultSize="85" minSize="50">
          {!selectedRequest ? (
            <div className="flex flex-1 h-full items-center justify-center">
              <EmptyState
                icon={Globe}
                title="요청을 선택하거나 새로 만드세요"
                description="좌측 트리에서 요청을 클릭하면 편집할 수 있습니다"
              />
            </div>
          ) : (
            <ResizablePanelGroup orientation="vertical" className="h-full">
              {/* Top: Request editor */}
              <ResizablePanel id="api-req" defaultSize="50%" minSize="20%">
                <div className="flex flex-col h-full min-h-0">
                  {/* URL bar */}
                  <div className="flex items-center gap-1 p-2 border-b border-border">
                    <Select
                      value={selectedRequest.method}
                      onValueChange={(v) => updateRequest({ method: v })}
                    >
                      <SelectTrigger className="h-8 w-[100px] text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                          <SelectItem key={m} value={m}>
                            <span className={METHOD_COLORS[m]}>{m}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={selectedRequest.url}
                      onChange={(e) => {
                        updateRequest({ url: e.target.value });
                        syncParamsFromUrl(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSend();
                      }}
                      placeholder="https://api.example.com/endpoint"
                      className="h-8 flex-1 text-sm font-mono"
                    />
                    <Button
                      size="sm"
                      className="h-8 px-4"
                      onClick={handleSend}
                      disabled={sending}
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5 mr-1" /> 전송
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Tabs: Headers / Params / Body */}
                  <div className="flex border-b border-border">
                    {(["headers", "params", "body"] as const).map((tab) => (
                      <button
                        key={tab}
                        className={`px-3 py-1.5 text-xs font-medium border-b-2 ${
                          activeReqTab === tab
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setActiveReqTab(tab)}
                      >
                        {tab === "params"
                          ? `Params (${(selectedRequest.params || []).length})`
                          : tab === "headers"
                            ? `Headers (${selectedRequest.headers.length})`
                            : "Body"}
                      </button>
                    ))}
                  </div>

                  {activeReqTab === "params" ? (
                    <ScrollArea className="flex-1">
                      <ParamEditor
                        params={selectedRequest.params || []}
                        onChange={(p) => syncUrlFromParams(p)}
                      />
                    </ScrollArea>
                  ) : activeReqTab === "headers" ? (
                    <ScrollArea className="flex-1">
                      <HeaderEditor
                        headers={selectedRequest.headers}
                        onChange={(h) => updateRequest({ headers: h })}
                      />
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 p-2 gap-1">
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={selectedRequest.body_type}
                          onChange={(e) =>
                            updateRequest({ body_type: e.target.value })
                          }
                          className="h-6 rounded border border-input bg-transparent px-1.5 text-[11px]"
                        >
                          <option value="json">JSON</option>
                          <option value="text">Text</option>
                        </select>
                      </div>
                      <textarea
                        value={selectedRequest.body}
                        onChange={(e) => updateRequest({ body: e.target.value })}
                        placeholder={
                          selectedRequest.body_type === "json"
                            ? '{\n  "key": "value"\n}'
                            : "Request body..."
                        }
                        className="w-full flex-1 min-h-0 resize-none rounded-md border border-input bg-transparent p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        spellCheck={false}
                      />
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Bottom: Response viewer */}
              <ResizablePanel id="api-res" defaultSize="50%" minSize="20%">
                <div className="flex flex-col h-full min-h-0">
                  {!response && !sending ? (
                    <div className="flex flex-1 items-center justify-center">
                      <EmptyState
                        icon={Send}
                        title="전송 버튼을 눌러 응답을 확인하세요"
                      />
                    </div>
                  ) : sending ? (
                    <div className="flex flex-1 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : response ? (
                    <>
                      {/* Response status bar */}
                      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border">
                        <Badge
                          variant={
                            response.status >= 200 && response.status < 300
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs font-mono"
                        >
                          {response.status} {response.status_text}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {response.time_ms}ms
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(response.size_bytes)}
                        </span>
                      </div>

                      {/* Response tabs */}
                      <div className="flex border-b border-border overflow-x-auto">
                        {(["general", "body", "headers", "request", "cookies"] as const).map((tab) => {
                          const cookieCount = response.headers.filter(
                            (h) => h.key.toLowerCase() === "set-cookie",
                          ).length;
                          const label =
                            tab === "general" ? "General" :
                            tab === "body" ? "Body" :
                            tab === "headers" ? `Headers (${response.headers.length})` :
                            tab === "request" ? "Request" :
                            `Cookies (${cookieCount})`;
                          return (
                            <button
                              key={tab}
                              className={`px-3 py-1.5 text-xs font-medium border-b-2 whitespace-nowrap ${
                                activeResTab === tab
                                  ? "border-primary text-primary"
                                  : "border-transparent text-muted-foreground hover:text-foreground"
                              }`}
                              onClick={() => setActiveResTab(tab)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      <ScrollArea className="flex-1">
                        {activeResTab === "general" ? (
                          <div className="p-3 flex flex-col gap-2 text-xs">
                            <div className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider">General</div>
                            <InfoRow label="Request URL" value={selectedRequest.url} />
                            <InfoRow label="Request Method" value={selectedRequest.method} />
                            <InfoRow
                              label="Status Code"
                              value={`${response.status} ${response.status_text}`}
                              valueClass={
                                response.status >= 200 && response.status < 300
                                  ? "text-green-500"
                                  : response.status >= 400
                                    ? "text-red-500"
                                    : "text-yellow-500"
                              }
                            />
                            <InfoRow label="응답 시간" value={`${response.time_ms}ms`} />
                            <InfoRow label="응답 크기" value={formatSize(response.size_bytes)} />
                            <InfoRow
                              label="Content-Type"
                              value={
                                response.headers.find((h) => h.key.toLowerCase() === "content-type")?.value || "-"
                              }
                            />
                            <InfoRow
                              label="Server"
                              value={
                                response.headers.find((h) => h.key.toLowerCase() === "server")?.value || "-"
                              }
                            />
                            <InfoRow
                              label="Cache-Control"
                              value={
                                response.headers.find((h) => h.key.toLowerCase() === "cache-control")?.value || "-"
                              }
                            />
                          </div>
                        ) : activeResTab === "body" ? (
                          <ResponseBody body={response.body} />
                        ) : activeResTab === "headers" ? (
                          <div className="p-3 flex flex-col gap-2 text-xs">
                            <div className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Response Headers</div>
                            {response.headers.map((h, i) => (
                              <InfoRow key={i} label={h.key} value={h.value} mono />
                            ))}
                          </div>
                        ) : activeResTab === "request" ? (
                          <div className="p-3 flex flex-col gap-2 text-xs">
                            <div className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Request Headers</div>
                            {selectedRequest.headers
                              .filter((h) => h.enabled && h.key)
                              .map((h, i) => (
                                <InfoRow key={i} label={h.key} value={h.value} mono />
                              ))}
                            {selectedRequest.headers.filter((h) => h.enabled && h.key).length === 0 && (
                              <span className="text-muted-foreground">(없음)</span>
                            )}

                            {selectedRequest.params && selectedRequest.params.filter((p) => p.enabled && p.key).length > 0 && (
                              <>
                                <div className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider mt-2">Query Parameters</div>
                                {selectedRequest.params
                                  .filter((p) => p.enabled && p.key)
                                  .map((p, i) => (
                                    <InfoRow key={i} label={p.key} value={p.value} mono />
                                  ))}
                              </>
                            )}

                            {selectedRequest.body && (
                              <>
                                <div className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider mt-2">Request Body</div>
                                <pre className="p-2 rounded bg-muted/50 font-mono text-xs whitespace-pre-wrap break-all">
                                  {tryPrettyJson(selectedRequest.body)}
                                </pre>
                              </>
                            )}
                          </div>
                        ) : activeResTab === "cookies" ? (
                          <div className="p-3 flex flex-col gap-2 text-xs">
                            {(() => {
                              const cookies = response.headers.filter(
                                (h) => h.key.toLowerCase() === "set-cookie",
                              );
                              if (cookies.length === 0)
                                return <span className="text-muted-foreground">쿠키가 없습니다</span>;
                              return cookies.map((c, i) => {
                                const parts = c.value.split(";").map((s) => s.trim());
                                const [nameVal, ...attrs] = parts;
                                const [name, ...valParts] = nameVal.split("=");
                                const value = valParts.join("=");
                                return (
                                  <div key={i} className="border border-border rounded p-2">
                                    <div className="flex gap-2 items-baseline">
                                      <span className="font-medium">{name}</span>
                                      <span className="text-muted-foreground font-mono break-all">{value}</span>
                                    </div>
                                    {attrs.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {attrs.map((attr, ai) => (
                                          <Badge key={ai} variant="outline" className="text-[10px]">
                                            {attr}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : null}
                      </ScrollArea>
                    </>
                  ) : null}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </TabPage>
  );
}

/* ── Response body with format/compact ── */
function ResponseBody({ body }: { body: string }) {
  const [mode, setMode] = useState<"pretty" | "compact" | "raw">("pretty");
  const [copied, setCopied] = useState(false);

  const displayed = mode === "pretty"
    ? tryPrettyJson(body)
    : mode === "compact"
      ? tryCompactJson(body)
      : body;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border shrink-0">
        {(["pretty", "compact", "raw"] as const).map((m) => (
          <button
            key={m}
            className={`px-2 py-0.5 rounded text-[10px] ${
              mode === m
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode(m)}
          >
            {m === "pretty" ? "Pretty" : m === "compact" ? "Compact" : "Raw"}
          </button>
        ))}
        <button
          className="ml-auto px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? "복사됨!" : "복사"}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all flex-1 overflow-auto">
        {displayed}
      </pre>
    </div>
  );
}

/* ── InfoRow component ── */
function InfoRow({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex gap-3 leading-relaxed">
      <span className="text-muted-foreground shrink-0 w-[140px] text-right">{label}:</span>
      <span className={`break-all ${mono ? "font-mono" : ""} ${valueClass || ""}`}>{value}</span>
    </div>
  );
}

/* ── Helpers ── */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryPrettyJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function tryCompactJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str));
  } catch {
    return str;
  }
}

/* ── Postman conversion ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPostmanItem(item: ApiItem): any {
  if (item.kind === "folder") {
    return {
      name: item.name,
      item: item.children.map(toPostmanItem),
    };
  }
  // Parse URL into Postman format
  let urlObj: { raw: string; protocol?: string; host?: string[]; path?: string[] } = { raw: item.url };
  try {
    const u = new URL(item.url);
    urlObj = {
      raw: item.url,
      protocol: u.protocol.replace(":", ""),
      host: u.hostname.split("."),
      path: u.pathname.split("/").filter(Boolean),
    };
  } catch { /* keep raw only */ }

  // Add query params to URL object
  if (item.params && item.params.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (urlObj as any).query = item.params
      .filter((p) => p.key)
      .map((p) => ({ key: p.key, value: p.value, disabled: !p.enabled }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req: any = {
    method: item.method,
    header: item.headers
      .filter((h) => h.key)
      .map((h) => ({ key: h.key, value: h.value, disabled: !h.enabled })),
    url: urlObj,
  };

  if (item.body && ["POST", "PUT", "PATCH"].includes(item.method)) {
    req.body = {
      mode: "raw",
      raw: item.body,
      options: {
        raw: {
          language: item.body_type === "json" ? "json" : "text",
        },
      },
    };
  }

  return { name: item.name, request: req, response: [] };
}

function exportToPostman(name: string, items: ApiItem[]): string {
  const collection = {
    info: {
      name,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: items.map(toPostmanItem),
  };
  return JSON.stringify(collection, null, 2);
}

function fromPostmanItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
): ApiItem {
  // Folder (has item array, no request)
  if (item.item && !item.request) {
    return {
      kind: "folder",
      id: crypto.randomUUID(),
      name: item.name || "Unnamed Folder",
      children: item.item.map(fromPostmanItem),
    };
  }

  const req = item.request || {};
  const method = (typeof req === "string" ? "GET" : req.method || "GET").toUpperCase();

  // URL
  let url = "";
  if (typeof req.url === "string") {
    url = req.url;
  } else if (req.url?.raw) {
    url = req.url.raw;
  }

  // Headers
  const headers: ApiHeader[] = (req.header || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (h: any) => ({
      key: h.key || "",
      value: h.value || "",
      enabled: !h.disabled,
    }),
  );

  // Query params
  const params: ApiParam[] = (req.url?.query || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => ({
      key: q.key || "",
      value: q.value || "",
      enabled: !q.disabled,
    }),
  );

  // Body
  let body = "";
  let bodyType = "json";
  if (req.body) {
    if (req.body.mode === "raw") {
      body = req.body.raw || "";
      bodyType = req.body.options?.raw?.language === "json" ? "json" : "text";
    }
  }

  return {
    kind: "request",
    id: crypto.randomUUID(),
    name: item.name || "Unnamed Request",
    method,
    url,
    headers,
    params,
    body,
    body_type: bodyType,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function importFromPostman(json: any): ApiItem[] {
  if (json.item) {
    return json.item.map(fromPostmanItem);
  }
  return [];
}
