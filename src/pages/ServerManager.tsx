import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import StatusDot from "@/components/StatusDot";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import {
  useServerStore,
  type ServerInfo,
  type PuttySession,
} from "@/stores/serverStore";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGroupRef } from "react-resizable-panels";
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Terminal,
  Download,
  ExternalLink,
  Loader2,
  GripVertical,
  Server,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import TabPage from "@/components/TabPage";

function SortableServerItem({
  server,
  selected,
  onSelect,
  onTerminal,
}: {
  server: ServerInfo;
  selected: boolean;
  onSelect: (server: ServerInfo) => void;
  onTerminal: (server: ServerInfo) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: server.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasCredentials = !!server.username && !!server.password;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex w-full items-center gap-2 px-2 py-1.5 hover:bg-accent ${
        selected ? "bg-accent" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground focus:outline-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <StatusDot variant={hasCredentials ? "online" : "offline"} />
      <button
        className="flex flex-1 flex-col items-start text-left min-w-0"
        onClick={() => onSelect(server)}
      >
        <span className="text-xs font-medium leading-tight">{server.name}</span>
        <span className="text-[10px] text-muted-foreground truncate w-full leading-tight">
          {server.host}:{server.port}
        </span>
      </button>
      {hasCredentials && (
        <button
          className="shrink-0 rounded p-1 text-primary/70 hover:bg-primary/10 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onTerminal(server);
          }}
          title="SSH 연결"
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const emptyServer: Omit<ServerInfo, "id" | "display_order"> = {
  name: "",
  host: "",
  port: 22,
  username: "",
  password: "",
  description: "",
};

export default function ServerManager() {
  const groupRef = useGroupRef();
  const { servers, loaded, loadServers, saveServer, deleteServer, saveServersOrder } =
    useServerStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = servers.findIndex((s) => s.id === active.id);
        const newIndex = servers.findIndex((s) => s.id === over.id);
        const reordered = arrayMove(servers, oldIndex, newIndex);
        saveServersOrder(reordered.map((s) => s.id));
      }
    },
    [servers, saveServersOrder],
  );

  const [form, setForm] = useState(emptyServer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [puttyOpen, setPuttyOpen] = useState(false);
  const [puttySessions, setPuttySessions] = useState<PuttySession[]>([]);
  const [puttySelected, setPuttySelected] = useState<Set<string>>(new Set());
  const [plinkDialogOpen, setPlinkDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loaded) loadServers();
  }, [loaded, loadServers]);

  useEffect(() => {
    requestAnimationFrame(() => {
      groupRef.current?.setLayout({ "sm-list": 15, "sm-form": 85 });
    });
  }, []);

  const handleSelect = useCallback(
    (server: ServerInfo) => {
      setSelectedId(server.id);
      setForm({
        name: server.name,
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
        description: server.description,
      });
      setEditingId(server.id);
    },
    [],
  );

  const handleReset = useCallback(() => {
    setForm(emptyServer);
    setEditingId(null);
    setSelectedId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.host) {
      setStatusMessage("이름과 호스트는 필수입니다");
      return;
    }
    try {
      const server: ServerInfo = {
        id: editingId || crypto.randomUUID(),
        display_order: editingId
          ? servers.find((s) => s.id === editingId)?.display_order ?? servers.length
          : servers.length,
        ...form,
      };
      await saveServer(server);
      setStatusMessage(editingId ? "서버 정보가 수정되었습니다" : "서버가 추가되었습니다");
      handleReset();
    } catch (e) {
      setStatusMessage(`저장 실패: ${e}`);
    }
  }, [form, editingId, servers, saveServer, handleReset]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    try {
      await deleteServer(editingId);
      setStatusMessage("서버가 삭제되었습니다");
      handleReset();
    } catch (e) {
      setStatusMessage(`삭제 실패: ${e}`);
    }
  }, [editingId, deleteServer, handleReset]);

  const handleTestConnection = useCallback(async () => {
    if (!form.host || !form.username) {
      setStatusMessage("호스트와 사용자명을 입력하세요");
      return;
    }
    setTesting(true);
    setStatusMessage("연결 테스트 중...");
    try {
      const result = await invoke<boolean>("ssh_test_connection", {
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
      });
      setStatusMessage(result ? "연결 성공!" : "인증 실패");
    } catch (e) {
      setStatusMessage(`연결 실패: ${e}`);
    } finally {
      setTesting(false);
    }
  }, [form]);

  const openTerminal = useCallback(async (server: ServerInfo) => {
    try {
      const plinkInstalled = await invoke<boolean>("check_plink_installed");
      if (!plinkInstalled) {
        setPlinkDialogOpen(true);
        return;
      }
      await invoke("open_ssh_terminal", {
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
      });
      setStatusMessage("터미널을 열었습니다");
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes("plink_not_found")) {
        setPlinkDialogOpen(true);
      } else {
        setStatusMessage(`터미널 열기 실패: ${errMsg}`);
      }
    }
  }, []);

  const handleOpenTerminal = useCallback(async () => {
    if (!editingId) return;
    const server = servers.find((s) => s.id === editingId);
    if (!server) return;
    openTerminal(server);
  }, [editingId, servers, openTerminal]);

  const handleListTerminal = useCallback(
    (server: ServerInfo) => {
      openTerminal(server);
    },
    [openTerminal],
  );

  const handleImportPutty = useCallback(async () => {
    try {
      const sessions = await invoke<PuttySession[]>("import_putty_sessions");
      setPuttySessions(sessions);
      setPuttySelected(new Set());
      setPuttyOpen(true);
    } catch (e) {
      setStatusMessage(`PuTTY 가져오기 실패: ${e}`);
    }
  }, []);

  const handlePuttyImportConfirm = useCallback(async () => {
    for (const session of puttySessions.filter((s) => puttySelected.has(s.name))) {
      const server: ServerInfo = {
        id: crypto.randomUUID(),
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        password: "",
        description: `PuTTY에서 가져옴`,
        display_order: servers.length,
      };
      await saveServer(server);
    }
    setPuttyOpen(false);
    setStatusMessage(`${puttySelected.size}개 세션을 가져왔습니다`);
  }, [puttySessions, puttySelected, servers.length, saveServer]);

  const hasCredentials = !!form.username && !!form.password;

  return (
    <TabPage
      helpKey="servermanager"
      toolbar={
        <Button size="sm" variant="ghost" onClick={handleImportPutty}>
          <Download className="mr-1 h-3.5 w-3.5" />
          PuTTY 가져오기
        </Button>
      }
      statusBar={
        <span className="text-xs text-muted-foreground">
          {statusMessage || `${servers.length}개 서버`}
        </span>
      }
    >
      <ResizablePanelGroup groupRef={groupRef} orientation="horizontal" className="flex-1 min-h-0">
        {/* Server List */}
        <ResizablePanel id="sm-list" defaultSize="15" minSize="10" maxSize="30">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <span className="text-xs font-medium">서버 목록</span>
            <span className="text-[10px] text-muted-foreground">{servers.length}</span>
          </div>
          <ScrollArea className="flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={servers.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-border">
                  {servers.map((server) => (
                    <SortableServerItem
                      key={server.id}
                      server={server}
                      selected={selectedId === server.id}
                      onSelect={handleSelect}
                      onTerminal={handleListTerminal}
                    />
                  ))}
                  {servers.length === 0 && (
                    <EmptyState
                      icon={Server}
                      title="서버 없음"
                      description="우측에서 추가하세요"
                    />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Form */}
        <ResizablePanel id="sm-form" defaultSize="85" minSize="30">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
            <span className="text-xs font-medium">
              {editingId ? "서버 수정" : "서버 추가"}
            </span>
            {/* SSH connect - prominent button in header */}
            {editingId && (
              <Button
                size="sm"
                onClick={handleOpenTerminal}
                disabled={!hasCredentials}
                className="h-7 gap-1"
              >
                <Terminal className="h-3.5 w-3.5" />
                SSH 연결
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-3 p-3">
              {/* Connection Info + Description merged */}
              <Card>
                <CardContent className="space-y-2 p-3">
                  <SectionHeader icon={Server} title="연결 정보" />
                  <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="name" className="text-xs">이름</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="서버 이름"
                        className="h-8"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="host" className="text-xs">호스트</Label>
                      <Input
                        id="host"
                        value={form.host}
                        onChange={(e) => setForm({ ...form, host: e.target.value })}
                        placeholder="192.168.1.1"
                        className="h-8"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="port" className="text-xs">포트</Label>
                      <Input
                        id="port"
                        type="number"
                        value={form.port}
                        onChange={(e) =>
                          setForm({ ...form, port: parseInt(e.target.value) || 22 })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="desc" className="text-xs">설명</Label>
                    <Input
                      id="desc"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="선택 사항"
                      className="h-8"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Auth */}
              <Card>
                <CardContent className="space-y-2 p-3">
                  <SectionHeader icon={Shield} title="인증" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="username" className="text-xs">사용자</Label>
                      <Input
                        id="username"
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="password" className="text-xs">비밀번호</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          className="h-8 pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions - compact row */}
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7" onClick={handleSave}>
                  {editingId ? (
                    <><Pencil className="mr-1 h-3 w-3" /> 수정</>
                  ) : (
                    <><Plus className="mr-1 h-3 w-3" /> 추가</>
                  )}
                </Button>
                {editingId && (
                  <Button size="sm" variant="destructive" className="h-7" onClick={handleDelete}>
                    <Trash2 className="mr-1 h-3 w-3" /> 삭제
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7" onClick={handleReset}>
                  <RotateCcw className="mr-1 h-3 w-3" /> 초기화
                </Button>
                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={handleTestConnection}
                    disabled={testing || !form.host || !hasCredentials}
                  >
                    {testing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    연결 테스트
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* PuTTY Import Dialog */}
      <Dialog open={puttyOpen} onOpenChange={setPuttyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PuTTY 세션 가져오기</DialogTitle>
            <DialogDescription>
              가져올 세션을 선택하세요
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="flex flex-col gap-2 py-2">
              {puttySessions.map((session) => (
                <label
                  key={session.name}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent"
                >
                  <Checkbox
                    checked={puttySelected.has(session.name)}
                    onCheckedChange={(checked) => {
                      const next = new Set(puttySelected);
                      if (checked) next.add(session.name);
                      else next.delete(session.name);
                      setPuttySelected(next);
                    }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{session.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.host}:{session.port}
                      {session.username && ` (${session.username})`}
                    </div>
                  </div>
                </label>
              ))}
              {puttySessions.length === 0 && (
                <EmptyState
                  icon={Download}
                  title="PuTTY 세션이 없습니다"
                />
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPuttyOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handlePuttyImportConfirm}
              disabled={puttySelected.size === 0}
            >
              가져오기 ({puttySelected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PuTTY Install Guide Dialog */}
      <Dialog open={plinkDialogOpen} onOpenChange={setPlinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PuTTY 설치 필요</DialogTitle>
            <DialogDescription>
              PuTTY가 설치되어 있지 않습니다. plink을 사용하여 SSH 연결을 하려면 PuTTY를 설치해주세요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlinkDialogOpen(false)}>
              닫기
            </Button>
            <Button
              onClick={async () => {
                try {
                  await invoke("open_external_url", {
                    url: "https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html",
                  });
                } catch {
                  // ignore
                }
                setPlinkDialogOpen(false);
              }}
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              다운로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabPage>
  );
}
