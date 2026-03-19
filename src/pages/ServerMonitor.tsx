import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import GaugeBar from "@/components/GaugeBar";
import StatCard from "@/components/StatCard";
import StatusDot from "@/components/StatusDot";
import EmptyState from "@/components/EmptyState";
import TabPage from "@/components/TabPage";
import ContainerTable from "@/components/server/ContainerTable";
import ContainerLogDialog from "@/components/server/ContainerLogDialog";
import {
  useServerStore,
  type ServerInfo,
  type ServerHealth,
  type DockerContainer,
} from "@/stores/serverStore";
import {
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Server,
  Wifi,
  WifiOff,
  Box,
  AlertCircle,
  Info,
  AlertTriangle,
  Cpu,
  MemoryStick,
  HardDrive,
} from "lucide-react";

/* ── Types ── */

interface ServerCard {
  server: ServerInfo;
  health: ServerHealth | null;
  containers: DockerContainer[];
  error: string | null;
  loading: boolean;
}

interface EventLog {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

/* ── Sortable server card with accordion ── */

function SortableServerCard({
  card,
  expanded,
  onToggle,
  showContainers,
  onViewLogs,
  onExecTerminal,
}: {
  card: ServerCard;
  expanded: boolean;
  onToggle: () => void;
  showContainers: boolean;
  onViewLogs: (server: ServerInfo, container: DockerContainer) => void;
  onExecTerminal: (server: ServerInfo, container: DockerContainer) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.server.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const borderColor = card.error
    ? "border-l-destructive"
    : card.health
      ? "border-l-green-500"
      : "border-l-border";

  const isRunning = (status: string) =>
    status.toLowerCase().startsWith("up");

  const parsePercent = (s: string) => parseFloat(s.replace("%", ""));

  /** Determine badge variant based on CPU/MEM usage */
  const containerBadgeVariant = (c: DockerContainer) => {
    if (!isRunning(c.status)) return "secondary" as const;
    const cpu = parsePercent(c.cpu_percent);
    const mem = parsePercent(c.mem_percent);
    if (cpu >= 90 || mem >= 90) return "destructive" as const;
    if (cpu >= 70 || mem >= 70) return "outline" as const;
    return "default" as const;
  };

  /** Determine StatusDot variant for container */
  const containerDotVariant = (c: DockerContainer) => {
    if (!isRunning(c.status)) return "offline" as const;
    const cpu = parsePercent(c.cpu_percent);
    const mem = parsePercent(c.mem_percent);
    if (cpu >= 90 || mem >= 90) return "offline" as const;
    if (cpu >= 70 || mem >= 70) return "warning" as const;
    return "online" as const;
  };

  const runningCount = card.containers.filter((c) => isRunning(c.status)).length;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border-l-3 ${borderColor} transition-colors ${isDragging ? "opacity-30 border-dashed" : ""}`}
    >
      <CardContent className="p-0">
        {/* ── Card header (always visible, clickable to toggle) ── */}
        <div
          className="flex items-center gap-2 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={onToggle}
        >
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}

          <StatusDot
            variant={card.error ? "offline" : card.health ? "online" : "loading"}
            pulse={card.loading}
          />
          <span className="font-medium">{card.server.name}</span>
          <span className="text-xs text-muted-foreground">
            {card.server.host}
          </span>

          {/* Compact gauges in collapsed header */}
          {!expanded && card.health && (
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Cpu className="h-3 w-3 text-blue-500" />
                <span className="text-xs tabular-nums">{card.health.cpu_usage.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <MemoryStick className="h-3 w-3 text-purple-500" />
                <span className="text-xs tabular-nums">{card.health.mem_usage_percent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-orange-500" />
                <span className="text-xs tabular-nums">{card.health.disk_usage_percent.toFixed(0)}%</span>
              </div>
              {card.containers.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  <Box className="mr-0.5 h-2.5 w-2.5" />
                  {runningCount}/{card.containers.length}
                </Badge>
              )}
            </div>
          )}

          {!expanded && card.loading && !card.health && !card.error && (
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          )}

          {!expanded && card.error && !card.health && (
            <span className="ml-auto text-xs text-destructive">연결 실패</span>
          )}
        </div>

        {/* ── Collapsed: container badges or skeleton ── */}
        {!expanded && showContainers && card.containers.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 pb-2.5 pt-0">
            {card.containers.map((c) => (
              <Badge
                key={c.container_id}
                variant={containerBadgeVariant(c)}
                className="gap-1 text-xs"
              >
                <StatusDot variant={containerDotVariant(c)} />
                {c.names}
              </Badge>
            ))}
          </div>
        )}
        {!expanded && card.loading && !card.health && !card.error && (
          <div className="flex gap-1 px-3 pb-2.5 pt-0">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        )}

        {/* ── Expanded: full detail ── */}
        {expanded && (
          <div className="border-t border-border p-3 space-y-3 animate-fade-in">
            {/* Loading skeleton */}
            {card.loading && !card.health && !card.error && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-3 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {card.error && (
              <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                {card.error}
              </div>
            )}

            {/* Host info */}
            {card.health && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{card.health.hostname}</p>
                      <p className="text-xs text-muted-foreground">
                        Uptime: {card.health.uptime}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Load Average</p>
                    <p className="text-sm font-medium tabular-nums">
                      {card.health.load_average}
                    </p>
                  </div>
                </div>

                {/* Resource gauges */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">CPU</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {card.health.cpu_usage.toFixed(1)}%
                    </p>
                    <GaugeBar
                      label=""
                      value={card.health.cpu_usage}
                      detail={`${card.health.cpu_cores}코어`}
                    />
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5">
                      <MemoryStick className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">메모리</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {card.health.mem_usage_percent.toFixed(1)}%
                    </p>
                    <GaugeBar
                      label=""
                      value={card.health.mem_usage_percent}
                      detail={`${card.health.mem_used}/${card.health.mem_total}MB`}
                    />
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">디스크</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {card.health.disk_usage_percent.toFixed(1)}%
                    </p>
                    <GaugeBar
                      label=""
                      value={card.health.disk_usage_percent}
                      detail={`${card.health.disk_used}/${card.health.disk_total}GB`}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Container table */}
            {card.containers.length > 0 && (
              <ContainerTable
                containers={card.containers}
                onViewLogs={(c) => onViewLogs(card.server, c)}
                onExecTerminal={(c) => onExecTerminal(card.server, c)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main component ── */

export default function ServerMonitor() {
  const { servers, loaded, loadServers, saveServersOrder } = useServerStore();

  /* ── State ── */
  const [cards, setCards] = useState<Map<string, ServerCard>>(new Map());
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [filterOnline, setFilterOnline] = useState(true);
  const [filterOffline, setFilterOffline] = useState(true);
  const [showContainers, setShowContainers] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Drag state ── */
  const [activeId, setActiveId] = useState<string | null>(null);

  /* ── Log dialog ── */
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logServer, setLogServer] = useState<ServerInfo | null>(null);
  const [logContainer, setLogContainer] = useState<DockerContainer | null>(null);

  /* ── DnD ── */
  const cardSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /* ── Load servers ── */
  useEffect(() => {
    if (!loaded) loadServers();
  }, [loaded, loadServers]);

  /* ── Event logger ── */
  const addEvent = useCallback(
    (level: EventLog["level"], message: string) => {
      const time = new Date().toLocaleTimeString();
      setEvents((prev) => [{ time, level, message }, ...prev].slice(0, 100));
    },
    [],
  );

  /* ── Fetch single server ── */
  const fetchServer = useCallback(
    async (server: ServerInfo) => {
      setCards((prev) => {
        const next = new Map(prev);
        next.set(server.id, {
          server,
          health: prev.get(server.id)?.health ?? null,
          containers: prev.get(server.id)?.containers ?? [],
          error: null,
          loading: true,
        });
        return next;
      });

      try {
        const [h, c] = await Promise.allSettled([
          invoke<ServerHealth>("get_server_health", {
            host: server.host,
            port: server.port,
            username: server.username,
            password: server.password,
          }),
          invoke<DockerContainer[]>("get_docker_containers", {
            host: server.host,
            port: server.port,
            username: server.username,
            password: server.password,
          }),
        ]);

        const health = h.status === "fulfilled" ? h.value : null;
        const containers = c.status === "fulfilled" ? c.value : [];
        const error = h.status === "rejected" ? String(h.reason) : null;

        if (error) addEvent("error", `${server.name}: 연결 실패`);
        else addEvent("info", `${server.name}: 조회 완료`);

        setCards((prev) => {
          const next = new Map(prev);
          next.set(server.id, { server, health, containers, error, loading: false });
          return next;
        });
      } catch (e) {
        addEvent("error", `${server.name}: ${e}`);
        setCards((prev) => {
          const next = new Map(prev);
          next.set(server.id, {
            server,
            health: null,
            containers: [],
            error: String(e),
            loading: false,
          });
          return next;
        });
      }
    },
    [addEvent],
  );

  /* ── Fetch all ── */
  const fetchAll = useCallback(async () => {
    if (servers.length === 0) return;
    setLoading(true);
    setCards((prev) => {
      const next = new Map(prev);
      for (const server of servers) {
        next.set(server.id, {
          server,
          health: prev.get(server.id)?.health ?? null,
          containers: prev.get(server.id)?.containers ?? [],
          error: null,
          loading: true,
        });
      }
      return next;
    });
    await Promise.allSettled(servers.map((s) => fetchServer(s)));
    setLoading(false);
  }, [servers, fetchServer]);

  /* ── Initial fetch ── */
  const initialFetched = useRef(false);
  useEffect(() => {
    if (servers.length > 0 && !initialFetched.current) {
      initialFetched.current = true;
      fetchAll();
    }
  }, [servers, fetchAll]);

  /* ── Auto refresh (15s) ── */
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAll, 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchAll]);

  /* ── Drag handlers ── */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleCardDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
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

  /* ── Accordion toggle ── */
  const toggleExpanded = useCallback((serverId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  }, []);

  /* ── Expand / Collapse all ── */
  const expandAll = useCallback(() => {
    setExpandedIds(new Set(servers.map((s) => s.id)));
  }, [servers]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /* ── Terminal exec ── */
  const handleExecTerminal = useCallback(
    async (server: ServerInfo, container: DockerContainer) => {
      try {
        await invoke("docker_exec_terminal", {
          host: server.host,
          port: server.port,
          username: server.username,
          password: server.password,
          containerId: container.container_id,
        });
        addEvent("info", `${container.names} 터미널 열림`);
      } catch (e) {
        addEvent("error", `터미널 열기 실패: ${e}`);
      }
    },
    [addEvent],
  );

  /* ── Log dialog ── */
  const handleViewLogs = useCallback(
    (server: ServerInfo, container: DockerContainer) => {
      setLogServer(server);
      setLogContainer(container);
      setLogDialogOpen(true);
    },
    [],
  );

  /* ── Computed ── */
  const allCards: ServerCard[] = servers.map(
    (server) =>
      cards.get(server.id) ?? {
        server,
        health: null,
        containers: [],
        error: null,
        loading: true,
      },
  );

  const filteredCards = allCards.filter((card) => {
    if (card.loading && !card.health) return true;
    if (card.error && !filterOffline) return false;
    if (!card.error && !filterOnline) return false;
    return true;
  });

  const totalServers = servers.length;
  const onlineServers = Array.from(cards.values()).filter(
    (c) => !c.error && c.health,
  ).length;
  const offlineServers = Array.from(cards.values()).filter(
    (c) => c.error,
  ).length;
  const totalContainers = Array.from(cards.values()).reduce(
    (sum, c) => sum + c.containers.length,
    0,
  );

  const hasExpanded = expandedIds.size > 0;

  /* ── Render ── */
  return (
    <TabPage
      helpKey="servermonitor"
      toolbar={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAll}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            새로고침
          </Button>

          <div className="flex items-center gap-1.5">
            <Checkbox
              id="autoRefresh"
              checked={autoRefresh}
              onCheckedChange={(v) => setAutoRefresh(!!v)}
            />
            <Label htmlFor="autoRefresh" className="text-xs">
              자동 (15s)
            </Label>
            {autoRefresh && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse-subtle" />
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={hasExpanded ? collapseAll : expandAll}
          >
            {hasExpanded ? "모두 접기" : "모두 펼치기"}
          </Button>
        </>
      }
    >
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {/* Stats strip */}
          {cards.size > 0 && (
            <div className="grid grid-cols-4 gap-3 animate-fade-in">
              <StatCard label="전체 서버" value={totalServers} icon={Server} />
              <StatCard
                label="온라인"
                value={onlineServers}
                icon={Wifi}
                color="text-green-500"
                active={filterOnline}
                onClick={() => setFilterOnline((v) => !v)}
              />
              <StatCard
                label="오프라인"
                value={offlineServers}
                icon={WifiOff}
                color="text-destructive"
                active={filterOffline}
                onClick={() => setFilterOffline((v) => !v)}
              />
              <StatCard
                label="컨테이너"
                value={totalContainers}
                icon={Box}
                active={showContainers}
                onClick={() => setShowContainers((v) => !v)}
              />
            </div>
          )}

          {/* Server cards (accordion) */}
          <DndContext
            sensors={cardSensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleCardDragEnd}
          >
            <SortableContext
              items={filteredCards.map((c) => c.server.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3 stagger-enter">
                {filteredCards.map((card) => (
                  <SortableServerCard
                    key={card.server.id}
                    card={card}
                    expanded={expandedIds.has(card.server.id)}
                    onToggle={() => toggleExpanded(card.server.id)}
                    showContainers={showContainers}
                    onViewLogs={handleViewLogs}
                    onExecTerminal={handleExecTerminal}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId ? (() => {
                const dragCard = filteredCards.find((c) => c.server.id === activeId);
                if (!dragCard) return null;
                const isRunning = (status: string) => status.toLowerCase().startsWith("up");
                const runningCount = dragCard.containers.filter((c) => isRunning(c.status)).length;
                const overlayBorder = dragCard.error
                  ? "border-l-destructive"
                  : dragCard.health
                    ? "border-l-green-500"
                    : "border-l-border";
                return (
                  <Card className={`border-l-3 ${overlayBorder} shadow-xl ring-2 ring-primary/40 rotate-[1.5deg]`}>
                    <CardContent className="p-0">
                      <div className="flex items-center gap-2 p-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <StatusDot
                          variant={dragCard.error ? "offline" : dragCard.health ? "online" : "loading"}
                        />
                        <span className="font-medium">{dragCard.server.name}</span>
                        <span className="text-xs text-muted-foreground">{dragCard.server.host}</span>
                        {dragCard.health && (
                          <div className="ml-auto flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Cpu className="h-3 w-3 text-blue-500" />
                              <span className="text-xs tabular-nums">{dragCard.health.cpu_usage.toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MemoryStick className="h-3 w-3 text-purple-500" />
                              <span className="text-xs tabular-nums">{dragCard.health.mem_usage_percent.toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3 text-orange-500" />
                              <span className="text-xs tabular-nums">{dragCard.health.disk_usage_percent.toFixed(0)}%</span>
                            </div>
                            {dragCard.containers.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                <Box className="mr-0.5 h-2.5 w-2.5" />
                                {runningCount}/{dragCard.containers.length}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })() : null}
            </DragOverlay>
          </DndContext>

          {servers.length === 0 && (
            <EmptyState
              icon={Server}
              title="등록된 서버가 없습니다"
              description="서버 관리 탭에서 서버를 등록하세요"
            />
          )}
        </div>
      </ScrollArea>

      {/* Event Log */}
      <div className="border-t border-border">
        <button
          className="flex w-full items-center gap-1 px-4 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
          onClick={() => setEventsOpen(!eventsOpen)}
        >
          {eventsOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          이벤트 로그 ({events.length})
        </button>
        {eventsOpen && (
          <ScrollArea className="max-h-32 border-t border-border">
            <div className="space-y-0 p-2">
              {events.map((e, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded px-2 py-0.5 font-mono text-xs ${
                    i % 2 === 0 ? "bg-muted/40" : ""
                  }`}
                >
                  {e.level === "error" ? (
                    <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
                  ) : e.level === "warn" ? (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500" />
                  ) : (
                    <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">[{e.time}]</span>
                  <span
                    className={
                      e.level === "error"
                        ? "text-destructive"
                        : e.level === "warn"
                          ? "text-yellow-500"
                          : "text-muted-foreground"
                    }
                  >
                    {e.message}
                  </span>
                </div>
              ))}
              {events.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  이벤트 없음
                </span>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Log dialog */}
      <ContainerLogDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        server={logServer}
        container={logContainer}
      />
    </TabPage>
  );
}
