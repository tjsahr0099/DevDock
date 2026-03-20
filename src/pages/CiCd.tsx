import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusDot from "@/components/StatusDot";
import SectionHeader from "@/components/SectionHeader";
import TabPage from "@/components/TabPage";
import {
  GitBranch,
  Server,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Link,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  EyeOff,
  Settings,
  Webhook,
  ExternalLink,
} from "lucide-react";

/* ── Mock Data ── */

interface JenkinsServer {
  id: string;
  name: string;
  url: string;
  username: string;
  apiToken: string;
}

interface GiteaServer {
  id: string;
  name: string;
  url: string;
  apiToken: string;
}

interface CiProject {
  id: string;
  name: string;
  giteaServerId: string;
  giteaRepo: string; // owner/repo
  jenkinsServerId: string;
  jenkinsJob: string;
  branch: string;
  webhookActive: boolean;
  lastBuild: BuildInfo | null;
}

interface BuildInfo {
  number: number;
  status: "success" | "failure" | "building" | "pending";
  timestamp: string;
  duration: string;
}

const MOCK_JENKINS: JenkinsServer[] = [
  { id: "j1", name: "Jenkins (Dev)", url: "http://jenkins.local:8080", username: "admin", apiToken: "****" },
];

const MOCK_GITEA: GiteaServer[] = [
  { id: "g1", name: "Gitea (사내)", url: "https://gitea.cudodev.synology.me:5001", apiToken: "****" },
];

const MOCK_PROJECTS: CiProject[] = [
  {
    id: "p1",
    name: "DevDock",
    giteaServerId: "g1",
    giteaRepo: "Platform_dev/DevDock",
    jenkinsServerId: "j1",
    jenkinsJob: "DevDock-Build",
    branch: "main",
    webhookActive: true,
    lastBuild: { number: 42, status: "success", timestamp: "2분 전", duration: "1m 23s" },
  },
  {
    id: "p2",
    name: "API Server",
    giteaServerId: "g1",
    giteaRepo: "Platform_dev/api-server",
    jenkinsServerId: "j1",
    jenkinsJob: "API-Server-Build",
    branch: "develop",
    webhookActive: true,
    lastBuild: { number: 108, status: "failure", timestamp: "15분 전", duration: "0m 45s" },
  },
  {
    id: "p3",
    name: "Frontend App",
    giteaServerId: "g1",
    giteaRepo: "Platform_dev/frontend",
    jenkinsServerId: "j1",
    jenkinsJob: "Frontend-Deploy",
    branch: "main",
    webhookActive: false,
    lastBuild: { number: 77, status: "building", timestamp: "방금", duration: "진행중..." },
  },
  {
    id: "p4",
    name: "Batch Service",
    giteaServerId: "g1",
    giteaRepo: "Platform_dev/batch",
    jenkinsServerId: "j1",
    jenkinsJob: "Batch-Build",
    branch: "main",
    webhookActive: false,
    lastBuild: null,
  },
];

/* ── Status helpers ── */

function buildStatusBadge(status: BuildInfo["status"]) {
  switch (status) {
    case "success":
      return (
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3" /> 성공
        </Badge>
      );
    case "failure":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> 실패
        </Badge>
      );
    case "building":
      return (
        <Badge variant="default" className="gap-1 bg-blue-600 hover:bg-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" /> 빌드중
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> 대기
        </Badge>
      );
  }
}

function buildDot(status: BuildInfo["status"] | null) {
  if (!status) return "offline" as const;
  switch (status) {
    case "success": return "online" as const;
    case "failure": return "offline" as const;
    case "building": return "loading" as const;
    case "pending": return "warning" as const;
  }
}

/* ── Component ── */

export default function CiCd() {
  const [projects] = useState<CiProject[]>(MOCK_PROJECTS);
  const [jenkinsServers] = useState<JenkinsServer[]>(MOCK_JENKINS);
  const [giteaServers] = useState<GiteaServer[]>(MOCK_GITEA);
  const [statusMessage, setStatusMessage] = useState("");

  /* Server config dialog */
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [serverTab, setServerTab] = useState<"jenkins" | "gitea">("jenkins");
  const [showToken, setShowToken] = useState(false);

  /* Project dialog */
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    giteaServerId: "",
    giteaRepo: "",
    jenkinsServerId: "",
    jenkinsJob: "",
    branch: "main",
  });

  const handleBuild = useCallback((project: CiProject) => {
    setStatusMessage(`${project.name} 빌드를 트리거했습니다 (#${(project.lastBuild?.number ?? 0) + 1})`);
  }, []);

  const handleWebhook = useCallback((project: CiProject) => {
    setStatusMessage(
      project.webhookActive
        ? `${project.name} Webhook이 이미 활성화되어 있습니다`
        : `${project.name} Webhook을 등록했습니다`
    );
  }, []);

  const successCount = projects.filter((p) => p.lastBuild?.status === "success").length;
  const failCount = projects.filter((p) => p.lastBuild?.status === "failure").length;
  const buildingCount = projects.filter((p) => p.lastBuild?.status === "building").length;

  return (
    <TabPage
      helpKey="cicd"
      toolbar={
        <>
          <Button size="sm" variant="outline" onClick={() => setServerDialogOpen(true)}>
            <Settings className="mr-1 h-3.5 w-3.5" />
            서버 설정
          </Button>
          <Button size="sm" variant="outline" onClick={() => setProjectDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            프로젝트 추가
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatusMessage("전체 상태를 새로고침했습니다")}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            새로고침
          </Button>
        </>
      }
      statusBar={
        <span className="text-xs text-muted-foreground">
          {statusMessage || `${projects.length}개 프로젝트 · Jenkins ${jenkinsServers.length} · Gitea ${giteaServers.length}`}
        </span>
      }
    >
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {/* Stats strip */}
          <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-xs">
            <span className="font-medium">프로젝트 {projects.length}</span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="h-3 w-3" /> 성공 {successCount}
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" /> 실패 {failCount}
            </span>
            <span className="flex items-center gap-1 text-blue-500">
              <Loader2 className="h-3 w-3" /> 빌드중 {buildingCount}
            </span>
          </div>

          {/* Project cards */}
          {projects.map((project) => {
            const gitea = giteaServers.find((g) => g.id === project.giteaServerId);
            const jenkins = jenkinsServers.find((j) => j.id === project.jenkinsServerId);

            return (
              <Card key={project.id} className="border-l-3 border-l-border transition-colors hover:bg-accent/20">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-3 py-2">
                    {/* Status + Name */}
                    <StatusDot variant={buildDot(project.lastBuild?.status ?? null)} pulse={project.lastBuild?.status === "building"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{project.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                          <GitBranch className="h-2.5 w-2.5" />
                          {project.branch}
                        </Badge>
                        {project.webhookActive && (
                          <Badge variant="secondary" className="text-[10px] h-4 gap-0.5">
                            <Webhook className="h-2.5 w-2.5" />
                            Hook
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-2.5 w-2.5" />
                          {gitea?.name}: {project.giteaRepo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Server className="h-2.5 w-2.5" />
                          {jenkins?.name}: {project.jenkinsJob}
                        </span>
                      </div>
                    </div>

                    {/* Last build info */}
                    <div className="flex items-center gap-2 shrink-0">
                      {project.lastBuild ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right text-[11px]">
                            <div className="text-muted-foreground">#{project.lastBuild.number} · {project.lastBuild.timestamp}</div>
                            <div className="text-muted-foreground">{project.lastBuild.duration}</div>
                          </div>
                          {buildStatusBadge(project.lastBuild.status)}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">빌드 기록 없음</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() => handleBuild(project)}
                        disabled={project.lastBuild?.status === "building"}
                      >
                        <Play className="h-3 w-3" />
                        빌드
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        onClick={() => handleWebhook(project)}
                        title={project.webhookActive ? "Webhook 활성" : "Webhook 등록"}
                      >
                        <Link className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setStatusMessage(`Jenkins 열기: ${jenkins?.url}/job/${project.jenkinsJob}`)}
                        title="Jenkins에서 열기"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {projects.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GitBranch className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">등록된 프로젝트가 없습니다</p>
              <p className="text-xs text-muted-foreground">프로젝트를 추가하여 CI/CD 파이프라인을 구성하세요</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Server Config Dialog ── */}
      <Dialog open={serverDialogOpen} onOpenChange={setServerDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>서버 설정</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1 mb-3">
            <Button
              size="sm"
              variant={serverTab === "jenkins" ? "default" : "outline"}
              onClick={() => setServerTab("jenkins")}
              className="h-7"
            >
              Jenkins
            </Button>
            <Button
              size="sm"
              variant={serverTab === "gitea" ? "default" : "outline"}
              onClick={() => setServerTab("gitea")}
              className="h-7"
            >
              Gitea
            </Button>
          </div>

          {serverTab === "jenkins" && (
            <div className="space-y-3">
              {jenkinsServers.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <Label className="text-xs">URL</Label>
                        <Input value={s.url} readOnly className="h-7 text-xs" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">사용자</Label>
                        <Input value={s.username} readOnly className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">API Token</Label>
                      <div className="relative">
                        <Input
                          type={showToken ? "text" : "password"}
                          value={s.apiToken}
                          readOnly
                          className="h-7 text-xs pr-8"
                        />
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowToken(!showToken)}
                        >
                          {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button size="sm" variant="outline" className="w-full h-8">
                <Plus className="mr-1 h-3 w-3" /> Jenkins 서버 추가
              </Button>
            </div>
          )}

          {serverTab === "gitea" && (
            <div className="space-y-3">
              {giteaServers.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">URL</Label>
                      <Input value={s.url} readOnly className="h-7 text-xs" />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">API Token</Label>
                      <div className="relative">
                        <Input
                          type={showToken ? "text" : "password"}
                          value={s.apiToken}
                          readOnly
                          className="h-7 text-xs pr-8"
                        />
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowToken(!showToken)}
                        >
                          {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button size="sm" variant="outline" className="w-full h-8">
                <Plus className="mr-1 h-3 w-3" /> Gitea 서버 추가
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setServerDialogOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Project Add Dialog ── */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>프로젝트 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1">
              <Label className="text-xs">프로젝트 이름</Label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                placeholder="My Project"
                className="h-8"
              />
            </div>

            <Card>
              <CardContent className="p-3 space-y-2">
                <SectionHeader icon={GitBranch} title="Git 저장소" />
                <div className="grid gap-1">
                  <Label className="text-xs">Gitea 서버</Label>
                  <Select
                    value={projectForm.giteaServerId}
                    onValueChange={(v) => setProjectForm({ ...projectForm, giteaServerId: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="서버 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {giteaServers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">저장소 (owner/repo)</Label>
                    <Input
                      value={projectForm.giteaRepo}
                      onChange={(e) => setProjectForm({ ...projectForm, giteaRepo: e.target.value })}
                      placeholder="org/repo-name"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">브랜치</Label>
                    <Input
                      value={projectForm.branch}
                      onChange={(e) => setProjectForm({ ...projectForm, branch: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 space-y-2">
                <SectionHeader icon={Server} title="Jenkins" />
                <div className="grid gap-1">
                  <Label className="text-xs">Jenkins 서버</Label>
                  <Select
                    value={projectForm.jenkinsServerId}
                    onValueChange={(v) => setProjectForm({ ...projectForm, jenkinsServerId: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="서버 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {jenkinsServers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Job 이름</Label>
                  <Input
                    value={projectForm.jenkinsJob}
                    onChange={(e) => setProjectForm({ ...projectForm, jenkinsJob: e.target.value })}
                    placeholder="My-Project-Build"
                    className="h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>취소</Button>
            <Button onClick={() => {
              setProjectDialogOpen(false);
              setStatusMessage(`${projectForm.name || "프로젝트"} 추가 완료`);
            }}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabPage>
  );
}
