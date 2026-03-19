import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Search } from "lucide-react";
import type { ServerInfo, DockerContainer } from "@/stores/serverStore";

interface ContainerLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: ServerInfo | null;
  container: DockerContainer | null;
}

export default function ContainerLogDialog({
  open,
  onOpenChange,
  server,
  container,
}: ContainerLogDialogProps) {
  const [logContent, setLogContent] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [search, setSearch] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLPreElement>(null);

  const fetchLogs = useCallback(async () => {
    if (!server || !container) return;
    try {
      const logs = await invoke<string>("get_docker_logs", {
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
        containerId: container.container_id,
        tail: 500,
      });
      setLogContent(logs || "(로그 없음)");
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    } catch (e) {
      setLogContent(`로그 조회 실패: ${e}`);
    }
  }, [server, container]);

  // Fetch on open
  useEffect(() => {
    if (open && server && container) {
      setLogContent("로딩 중...");
      setAutoRefresh(false);
      setSearch("");
      fetchLogs();
    }
  }, [open, server, container, fetchLogs]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && open) {
      intervalRef.current = setInterval(fetchLogs, 3000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, open, fetchLogs]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      onOpenChange(v);
      if (!v) setAutoRefresh(false);
    },
    [onOpenChange],
  );

  const displayedLog = search
    ? logContent
        .split("\n")
        .filter((line) => line.toLowerCase().includes(search.toLowerCase()))
        .join("\n")
    : logContent;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            컨테이너 로그 - {container?.names}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchLogs}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            새로고침
          </Button>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="logAuto"
              checked={autoRefresh}
              onCheckedChange={(v) => setAutoRefresh(!!v)}
            />
            <Label htmlFor="logAuto" className="text-xs">
              자동 (3s)
            </Label>
          </div>
          <div className="ml-auto relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="로그 검색..."
              className="h-7 w-48 pl-7 text-xs"
            />
          </div>
        </div>
        <pre
          ref={scrollRef}
          className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs font-mono"
        >
          {displayedLog}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
