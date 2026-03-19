import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusDot from "@/components/StatusDot";
import { Search, ScrollText, Terminal } from "lucide-react";
import type { DockerContainer } from "@/stores/serverStore";

interface ContainerTableProps {
  containers: DockerContainer[];
  onViewLogs: (container: DockerContainer) => void;
  onExecTerminal: (container: DockerContainer) => void;
}

function isRunning(status: string) {
  return status.toLowerCase().startsWith("up");
}

/** Parse "12.50%" → 12.5, returns NaN if unparseable */
function parsePercent(s: string): number {
  return parseFloat(s.replace("%", ""));
}

/** Return color class based on percentage: >=90 red, >=70 yellow, else default */
function usageColor(value: number): string {
  if (isNaN(value)) return "";
  if (value >= 90) return "text-destructive font-semibold";
  if (value >= 70) return "text-yellow-500 font-semibold";
  return "";
}

export default function ContainerTable({
  containers,
  onViewLogs,
  onExecTerminal,
}: ContainerTableProps) {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? containers.filter(
        (c) =>
          c.names.toLowerCase().includes(filter.toLowerCase()) ||
          c.image.toLowerCase().includes(filter.toLowerCase()),
      )
    : containers;

  if (containers.length === 0) return null;

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className="text-sm font-medium">컨테이너</span>
          <Badge variant="secondary">{containers.length}</Badge>
          <div className="ml-auto relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="검색..."
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
        </div>
        <div>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>이름</TableHead>
                <TableHead>이미지</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>메모리</TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, i) => (
                <TableRow
                  key={c.container_id}
                  className={i % 2 === 0 ? "bg-muted/20" : ""}
                >
                  <TableCell>
                    <StatusDot
                      variant={isRunning(c.status) ? "online" : "offline"}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.names}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.image}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isRunning(c.status) ? "default" : "secondary"}
                    >
                      {c.status.split(" ")[0]}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-xs tabular-nums ${usageColor(parsePercent(c.cpu_percent))}`}>
                    {c.cpu_percent}
                  </TableCell>
                  <TableCell className={`text-xs tabular-nums ${usageColor(parsePercent(c.mem_percent))}`}>
                    {c.mem_usage}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => onViewLogs(c)}
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => onExecTerminal(c)}
                      disabled={!isRunning(c.status)}
                      title="컨테이너 터미널"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
