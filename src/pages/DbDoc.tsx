import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SectionHeader from "@/components/SectionHeader";
import {
  Database,
  FolderOpen,
  FileSpreadsheet,
  BookOpen,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  User,
  Settings2,
} from "lucide-react";
import TabPage from "@/components/TabPage";

interface DbSettings {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  outputPath: string;
  author: string;
  dbUser: string;
}

const DEFAULT_SETTINGS: DbSettings = {
  host: "localhost",
  port: "3306",
  database: "",
  username: "root",
  password: "",
  outputPath: "",
  author: "",
  dbUser: "",
};

export default function DbDoc() {
  const [settings, setSettings] = useState<DbSettings>(DEFAULT_SETTINGS);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [connectionMsg, setConnectionMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    filePath?: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    invoke<string>("get_settings")
      .then((json) => {
        try {
          const data = JSON.parse(json);
          if (data.dbDoc) {
            setSettings((prev) => ({ ...prev, ...data.dbDoc }));
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  const updateSettings = (partial: Partial<DbSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    invoke("get_settings")
      .then((json) => {
        try {
          const data = JSON.parse(json as string);
          data.dbDoc = next;
          return invoke("save_settings", { json: JSON.stringify(data) });
        } catch {
          return invoke("save_settings", {
            json: JSON.stringify({ dbDoc: next }),
          });
        }
      })
      .catch(() => {});
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setConnectionMsg("");
    try {
      await invoke("test_db_connection", {
        host: settings.host,
        port: parseInt(settings.port) || 3306,
        database: settings.database,
        username: settings.username,
        password: settings.password,
      });
      setConnectionStatus("success");
      setConnectionMsg("연결 성공!");
    } catch (e) {
      setConnectionStatus("failed");
      setConnectionMsg(`연결 실패: ${e}`);
    }
  };

  const handleBrowseOutput = async () => {
    const selected = await open({ directory: true });
    if (selected) {
      updateSettings({ outputPath: selected as string });
    }
  };

  const setupProgressListener = async () => {
    if (unlistenRef.current) unlistenRef.current();
    const unlisten = await listen<{ message: string; progress: number }>(
      "generate-progress",
      (event) => {
        setProgressMsg(event.payload.message);
        setProgressValue(Math.round(event.payload.progress * 100));
      },
    );
    unlistenRef.current = unlisten;
  };

  const handleGenerate = async () => {
    if (!settings.outputPath) {
      setResult({ type: "error", message: "출력 경로를 선택하세요." });
      return;
    }
    setGenerating(true);
    setResult(null);
    setProgressValue(0);
    setProgressMsg("시작 중...");
    await setupProgressListener();

    try {
      const filePath = await invoke<string>("generate_table_definition", {
        host: settings.host,
        port: parseInt(settings.port) || 3306,
        database: settings.database,
        username: settings.username,
        password: settings.password,
        outputPath: settings.outputPath,
        author: settings.author || "",
        dbUser: settings.dbUser || "",
      });
      setResult({
        type: "success",
        message: "테이블 정의서가 생성되었습니다.",
        filePath,
      });
    } catch (e) {
      setResult({ type: "error", message: `생성 실패: ${e}` });
    } finally {
      setGenerating(false);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  };

  const handleDictionary = async () => {
    if (!settings.outputPath) {
      setResult({ type: "error", message: "출력 경로를 선택하세요." });
      return;
    }
    setGenerating(true);
    setResult(null);
    setProgressValue(0);
    setProgressMsg("시작 중...");
    await setupProgressListener();

    try {
      const filePath = await invoke<string>("generate_dictionary", {
        host: settings.host,
        port: parseInt(settings.port) || 3306,
        database: settings.database,
        username: settings.username,
        password: settings.password,
        outputPath: settings.outputPath,
      });
      setResult({
        type: "success",
        message: "데이터 사전이 생성되었습니다.",
        filePath,
      });
    } catch (e) {
      setResult({ type: "error", message: `생성 실패: ${e}` });
    } finally {
      setGenerating(false);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  };

  const handleOpenFolder = () => {
    if (result?.filePath) {
      const dir = result.filePath.replace(/[/\\][^/\\]+$/, "");
      invoke("open_in_explorer", { path: dir }).catch(() => {});
    }
  };

  return (
    <TabPage helpKey="dbdoc">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5 stagger-enter">
          {/* DB Connection */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionHeader
                icon={Database}
                title="데이터베이스 연결 정보"
                description="MySQL 데이터베이스에 연결합니다"
              />
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Host</Label>
                  <Input
                    value={settings.host}
                    onChange={(e) => updateSettings({ host: e.target.value })}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    value={settings.port}
                    onChange={(e) =>
                      updateSettings({
                        port: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="3306"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Database</Label>
                  <Input
                    value={settings.database}
                    onChange={(e) =>
                      updateSettings({ database: e.target.value })
                    }
                    placeholder="mydb"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input
                    value={settings.username}
                    onChange={(e) =>
                      updateSettings({ username: e.target.value })
                    }
                    placeholder="root"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={settings.password}
                      onChange={(e) =>
                        updateSettings({ password: e.target.value })
                      }
                      placeholder="********"
                      className="pr-8"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={
                      connectionStatus === "testing" ||
                      !settings.host ||
                      !settings.database
                    }
                    className="w-full"
                  >
                    {connectionStatus === "testing" ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : connectionStatus === "success" ? (
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-500" />
                    ) : connectionStatus === "failed" ? (
                      <XCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Database className="mr-1 h-3.5 w-3.5" />
                    )}
                    연결 테스트
                  </Button>
                </div>
              </div>
              {connectionMsg && (
                <Alert variant={connectionStatus === "success" ? "default" : "destructive"}>
                  <AlertDescription className="text-xs">
                    {connectionStatus === "success" ? (
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    {connectionMsg}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionHeader
                icon={User}
                title="추가 정보"
                description="문서에 포함할 작성자 정보"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">작성자</Label>
                  <Input
                    value={settings.author}
                    onChange={(e) => updateSettings({ author: e.target.value })}
                    placeholder="홍길동"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">DB User</Label>
                  <Input
                    value={settings.dbUser}
                    onChange={(e) => updateSettings({ dbUser: e.target.value })}
                    placeholder="app_user"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Output Path */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionHeader
                icon={Settings2}
                title="출력 설정"
                description="생성된 파일이 저장될 경로"
              />
              <div className="flex gap-2">
                <Input
                  value={settings.outputPath}
                  onChange={(e) =>
                    updateSettings({ outputPath: e.target.value })
                  }
                  placeholder="출력 폴더를 선택하세요"
                  className="flex-1"
                  readOnly
                />
                <Button size="sm" variant="outline" onClick={handleBrowseOutput}>
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />
                  찾아보기
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={
                generating || !settings.database || !settings.outputPath
              }
            >
              {generating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1 h-4 w-4" />
              )}
              정의서 생성
            </Button>
            <Button
              variant="outline"
              onClick={handleDictionary}
              disabled={
                generating || !settings.database || !settings.outputPath
              }
            >
              {generating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="mr-1 h-4 w-4" />
              )}
              데이터 사전
            </Button>
          </div>

          {/* Progress */}
          {generating && (
            <Card className="animate-slide-in-up">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <Progress value={progressValue} className="flex-1" />
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {progressValue}%
                  </span>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {progressMsg}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {result && !generating && (
            <Alert
              variant={result.type === "success" ? "default" : "destructive"}
              className="animate-slide-in-up"
            >
              <AlertDescription className="text-center text-sm">
                {result.type === "success" ? (
                  <CheckCircle2 className="mr-1 inline h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="mr-1 inline h-4 w-4" />
                )}
                {result.message}
                {result.filePath && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2"
                    onClick={handleOpenFolder}
                  >
                    <FolderOpen className="mr-1 h-3.5 w-3.5" />
                    폴더 열기
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </TabPage>
  );
}
