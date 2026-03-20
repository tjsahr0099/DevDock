import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusDot from "@/components/StatusDot";
import EmptyState from "@/components/EmptyState";
import TabPage from "@/components/TabPage";
import { useServerStore } from "@/stores/serverStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Network,
} from "lucide-react";

/* ── Types ── */

type CheckType = "telnet" | "ping" | "http";

interface CheckResult {
  success: boolean;
  message: string;
  responseTime: string;
  timestamp: string;
}

interface CheckItem {
  id: string;
  label: string;
  type: CheckType;
  host: string;
  port: string;
  httpUrl: string;
  loading: boolean;
  result: CheckResult | null;
}

interface NetCheckResultBackend {
  success: boolean;
  message: string;
  response_time_ms: number;
}

interface NetCheckTargetBackend {
  id: string;
  label: string;
  type: string;
  host: string;
  port: string;
  http_url: string;
}

/* ── Inline select (no radix overhead, matches input height exactly) ── */

function TypeSelect({
  value,
  onChange,
}: {
  value: CheckType;
  onChange: (v: CheckType) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CheckType)}
      className="h-7 w-[76px] shrink-0 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="telnet">Telnet</option>
      <option value="ping">Ping</option>
      <option value="http">HTTP</option>
    </select>
  );
}

/* ── Component ── */

export default function NetCheck() {
  const { servers, loaded: serversLoaded, loadServers } = useServerStore();
  const [selectedServerId, setSelectedServerId] = useState("");
  const [items, setItems] = useState<CheckItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadedServerId, setLoadedServerId] = useState<string | null>(null);

  const selectedServer = servers.find((s) => s.id === selectedServerId) ?? null;

  useEffect(() => {
    if (!serversLoaded) loadServers();
  }, [serversLoaded, loadServers]);

  /* ── Load targets when server changes ── */
  useEffect(() => {
    if (!selectedServerId) {
      setItems([]);
      setLoadedServerId(null);
      return;
    }
    (async () => {
      try {
        const raw = await invoke<string>("get_netcheck_targets", { serverId: selectedServerId });
        const saved = JSON.parse(raw) as NetCheckTargetBackend[];
        setItems(
          saved.map((t) => ({
            id: t.id,
            label: t.label,
            type: t.type as CheckType,
            host: t.host,
            port: t.port,
            httpUrl: t.http_url,
            loading: false,
            result: null,
          })),
        );
      } catch {
        setItems([]);
      }
      setLoadedServerId(selectedServerId);
    })();
  }, [selectedServerId]);

  /* ── Auto-save targets for current server (debounced) ── */
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loadedServerId || loadedServerId !== selectedServerId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const targets = items.map((item) => ({
        id: item.id,
        label: item.label,
        type: item.type,
        host: item.host,
        port: item.port,
        http_url: item.httpUrl,
      }));
      await invoke("save_netcheck_targets", {
        serverId: selectedServerId,
        data: JSON.stringify(targets),
      }).catch(() => {});
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [items, loadedServerId, selectedServerId]);

  const updateItem = useCallback((id: string, patch: Partial<CheckItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "telnet",
        host: "",
        port: "",
        httpUrl: "",
        loading: false,
        result: null,
      },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const runSingle = useCallback(
    async (item: CheckItem) => {
      if (!selectedServer) {
        setStatusMessage("From 서버를 선택하세요");
        return;
      }
      if (item.type === "ping" && !item.host) return;
      if (item.type === "telnet" && (!item.host || !item.port)) return;
      if (item.type === "http" && !item.httpUrl) return;

      updateItem(item.id, { loading: true, result: null });

      try {
        const res = await invoke<NetCheckResultBackend>("run_netcheck", {
          serverHost: selectedServer.host,
          serverPort: selectedServer.port,
          serverUsername: selectedServer.username,
          serverPassword: selectedServer.password,
          checkType: item.type,
          targetHost: item.host,
          targetPort: item.port,
          httpUrl: item.httpUrl,
        });
        const now = new Date().toLocaleTimeString();
        updateItem(item.id, {
          loading: false,
          result: {
            success: res.success,
            message: res.message,
            responseTime:
              res.response_time_ms >= 0 ? `${res.response_time_ms}ms` : "-",
            timestamp: now,
          },
        });
        setStatusMessage(`${item.label || item.host} — ${res.message}`);
      } catch (e) {
        const now = new Date().toLocaleTimeString();
        updateItem(item.id, {
          loading: false,
          result: {
            success: false,
            message: `오류: ${e}`,
            responseTime: "-",
            timestamp: now,
          },
        });
      }
    },
    [selectedServer, updateItem],
  );

  const runAll = useCallback(async () => {
    if (!selectedServer || items.length === 0) return;
    setStatusMessage("전체 검사 중...");
    setItems((prev) =>
      prev.map((item) => ({ ...item, loading: true, result: null })),
    );
    await Promise.allSettled(
      items.map(async (item) => {
        if (item.type === "ping" && !item.host) return;
        if (item.type === "telnet" && (!item.host || !item.port)) return;
        if (item.type === "http" && !item.httpUrl) return;
        try {
          const res = await invoke<NetCheckResultBackend>("run_netcheck", {
            serverHost: selectedServer.host,
            serverPort: selectedServer.port,
            serverUsername: selectedServer.username,
            serverPassword: selectedServer.password,
            checkType: item.type,
            targetHost: item.host,
            targetPort: item.port,
            httpUrl: item.httpUrl,
          });
          const now = new Date().toLocaleTimeString();
          updateItem(item.id, {
            loading: false,
            result: {
              success: res.success,
              message: res.message,
              responseTime:
                res.response_time_ms >= 0 ? `${res.response_time_ms}ms` : "-",
              timestamp: now,
            },
          });
        } catch (e) {
          const now = new Date().toLocaleTimeString();
          updateItem(item.id, {
            loading: false,
            result: {
              success: false,
              message: `오류: ${e}`,
              responseTime: "-",
              timestamp: now,
            },
          });
        }
      }),
    );
    setItems((latest) => {
      const ok = latest.filter((i) => i.result?.success).length;
      const fail = latest.filter((i) => i.result && !i.result.success).length;
      setStatusMessage(`검사 완료 — 성공 ${ok} / 실패 ${fail}`);
      return latest;
    });
  }, [selectedServer, items, updateItem]);

  const successCount = items.filter((i) => i.result?.success).length;
  const failCount = items.filter((i) => i.result && !i.result.success).length;
  const untestedCount = items.filter((i) => !i.result && !i.loading).length;
  const anyLoading = items.some((i) => i.loading);

  return (
    <TabPage
      helpKey="netcheck"
      toolbar={
        <>
          <Select value={selectedServerId} onValueChange={setSelectedServerId}>
            <SelectTrigger className="h-7 w-[200px] text-xs">
              <SelectValue placeholder="From 서버 선택" />
            </SelectTrigger>
            <SelectContent>
              {servers
                .filter((s) => s.username && s.password)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.host})
                  </SelectItem>
                ))}
              {servers.filter((s) => s.username && s.password).length === 0 && (
                <SelectItem value="_none" disabled>
                  인증 정보가 있는 서버가 없습니다
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            항목 추가
          </Button>
          <Button
            size="sm"
            onClick={runAll}
            disabled={items.length === 0 || !selectedServer || anyLoading}
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            전체 검사
          </Button>
        </>
      }
      statusBar={
        <span className="text-xs text-muted-foreground">
          {statusMessage || `${items.length}개 항목`}
        </span>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Network}
            title="검사 항목이 없습니다"
            description="항목을 추가하여 Ping, 포트, HTTP 연결을 테스트하세요"
            action={
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 항목 추가
              </Button>
            }
          />
        </div>
      ) : (
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Stats bar */}
          {items.length > 0 && (
            <div className="flex items-center gap-3 mb-1.5 px-2 py-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                From: {selectedServer?.name ?? "미선택"}
              </span>
              <span>→</span>
              <span>항목 {items.length}</span>
              <span className="flex items-center gap-0.5 text-green-500">
                <CheckCircle2 className="h-3 w-3" /> {successCount}
              </span>
              <span className="flex items-center gap-0.5 text-destructive">
                <XCircle className="h-3 w-3" /> {failCount}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {untestedCount}
              </span>
            </div>
          )}

          {/* Table header */}
          {items.length > 0 && (
            <div className="grid items-center px-2 pb-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
              style={{ gridTemplateColumns: "16px 120px 76px 1fr 64px 120px 28px 28px" }}
            >
              <span />
              <span>이름</span>
              <span>타입</span>
              <span>대상</span>
              <span>포트</span>
              <span className="text-right">결과</span>
              <span />
              <span />
            </div>
          )}

          {/* Rows */}
          <div className="flex flex-col">
            {items.map((item, idx) => (
              <div key={item.id}>
                <div
                  className={`grid items-center gap-1.5 px-2 py-[5px] rounded transition-colors hover:bg-accent/40 ${
                    idx % 2 === 0 ? "bg-muted/20" : ""
                  }`}
                  style={{ gridTemplateColumns: "16px 120px 76px 1fr 64px 120px 28px 28px" }}
                >
                  {/* Status dot */}
                  <StatusDot
                    variant={
                      item.loading
                        ? "loading"
                        : item.result
                          ? item.result.success
                            ? "online"
                            : "offline"
                          : "warning"
                    }
                    pulse={item.loading}
                  />

                  {/* Name */}
                  <Input
                    value={item.label}
                    onChange={(e) => updateItem(item.id, { label: e.target.value })}
                    placeholder="이름"
                    className="h-7 text-xs"
                  />

                  {/* Type */}
                  <TypeSelect
                    value={item.type}
                    onChange={(v) => updateItem(item.id, { type: v, result: null })}
                  />

                  {/* Target host / URL */}
                  {item.type === "http" ? (
                    <Input
                      value={item.httpUrl}
                      onChange={(e) => updateItem(item.id, { httpUrl: e.target.value })}
                      placeholder="https://example.com/health"
                      className="h-7 text-xs"
                    />
                  ) : (
                    <Input
                      value={item.host}
                      onChange={(e) => updateItem(item.id, { host: e.target.value })}
                      placeholder="IP / 호스트"
                      className="h-7 text-xs"
                    />
                  )}

                  {/* Port */}
                  {item.type === "telnet" ? (
                    <Input
                      value={item.port}
                      onChange={(e) => updateItem(item.id, { port: e.target.value })}
                      placeholder="포트"
                      className="h-7 text-xs"
                    />
                  ) : (
                    <span />
                  )}

                  {/* Result */}
                  <div className="flex items-center justify-end gap-1">
                    {item.loading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {item.result && (
                      <>
                        <Badge
                          variant={item.result.success ? "default" : "destructive"}
                          className="text-[10px] h-[18px] gap-0.5 px-1.5"
                        >
                          {item.result.success ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <XCircle className="h-2.5 w-2.5" />
                          )}
                          {item.result.responseTime}
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* Run */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => runSingle(item)}
                    disabled={item.loading || !selectedServer}
                    title="검사"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>

                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    title="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Error detail */}
                {item.result && !item.result.success && (
                  <div
                    className="grid px-2 pb-1"
                    style={{ gridTemplateColumns: "16px 1fr" }}
                  >
                    <span />
                    <span className="text-[11px] text-destructive">
                      {item.result.message}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </ScrollArea>
      )}
    </TabPage>
  );
}
