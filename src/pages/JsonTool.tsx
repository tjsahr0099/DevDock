import { useState, useCallback, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type * as monacoEditor from "monaco-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGroupRef } from "react-resizable-panels";
import { useTheme } from "@/hooks/useTheme";
import {
  ClipboardPaste,
  Trash2,
  Copy,
  FileJson,
  ChevronDown,
  ArrowRightLeft,
  AlertCircle,
  Keyboard,
} from "lucide-react";
import TabPage from "@/components/TabPage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JsonError {
  message: string;
  line: number;
  column: number;
}

function parseJsonError(input: string): JsonError | null {
  try {
    JSON.parse(input);
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    const posMatch = msg.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      let line = 1;
      let col = 1;
      for (let i = 0; i < pos && i < input.length; i++) {
        if (input[i] === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
      }
      return { message: msg, line, column: col };
    }
    return { message: msg, line: 1, column: 1 };
  }
}

const SAMPLE_JSON = `{
  "name": "DevDock",
  "version": "0.1.0",
  "features": [
    "JSON Tool",
    "Markdown Viewer",
    "PlantUML Viewer"
  ],
  "settings": {
    "theme": "dark",
    "language": "ko"
  }
}`;

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  shortcut,
  disabled,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  disabled?: boolean;
}) {
  if (shortcut) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
            <Icon className="mr-1 h-3.5 w-3.5" />
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-1.5 text-xs">
          <Keyboard className="h-3 w-3" />
          {shortcut}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
      <Icon className="mr-1 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export default function JsonTool() {
  const { theme } = useTheme();
  const groupRef = useGroupRef();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState<JsonError | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputEditorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputEditorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);

  const updateError = useCallback(
    (value: string) => {
      if (value.trim() === "") {
        setError(null);
        return;
      }
      const err = parseJsonError(value);
      setError(err);
    },
    [],
  );

  const handleInputChange = useCallback(
    (value: string | undefined) => {
      const v = value ?? "";
      setInput(v);
      updateError(v);
    },
    [updateError],
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      groupRef.current?.setLayout({ "jt-input": 50, "jt-output": 50 });
    });
  }, []);

  useEffect(() => {
    const editor = inputEditorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const monaco = (window as unknown as { monaco?: typeof import("monaco-editor") }).monaco;
    if (!monaco) return;

    if (error) {
      monaco.editor.setModelMarkers(model, "json-validation", [
        {
          startLineNumber: error.line,
          startColumn: error.column,
          endLineNumber: error.line,
          endColumn: error.column + 1,
          message: error.message,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
    } else {
      monaco.editor.setModelMarkers(model, "json-validation", []);
    }
  }, [error]);

  const handleFormat = useCallback(() => {
    if (input.trim() === "") return;
    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, indent);
      setOutput(formatted);
      setStatusMessage(
        `포맷팅 완료 (${formatted.length}자, ${formatted.split("\n").length}줄)`,
      );
    } catch {
      setStatusMessage("유효하지 않은 JSON입니다");
    }
  }, [input, indent]);

  const handleMinify = useCallback(() => {
    if (input.trim() === "") return;
    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      setStatusMessage(`압축 완료 (${minified.length}자)`);
    } catch {
      setStatusMessage("유효하지 않은 JSON입니다");
    }
  }, [input]);

  const handleValidate = useCallback(() => {
    if (input.trim() === "") {
      setStatusMessage("입력이 비어있습니다");
      return;
    }
    const err = parseJsonError(input);
    if (err) {
      setStatusMessage(`유효하지 않은 JSON: ${err.message}`);
    } else {
      const parsed = JSON.parse(input);
      const keys = Array.isArray(parsed)
        ? `배열 (${parsed.length}개 항목)`
        : `객체 (${Object.keys(parsed).length}개 키)`;
      setStatusMessage(`유효한 JSON - ${keys}`);
    }
  }, [input]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      updateError(text);
      setStatusMessage("클립보드에서 붙여넣기 완료");
    } catch {
      setStatusMessage("클립보드 접근 실패");
    }
  }, [updateError]);

  const handleCopyOutput = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setStatusMessage("결과가 클립보드에 복사되었습니다");
    } catch {
      setStatusMessage("복사 실패");
    }
  }, [output]);

  const handleSample = useCallback(() => {
    setInput(SAMPLE_JSON);
    updateError(SAMPLE_JSON);
    setStatusMessage("샘플 JSON이 입력되었습니다");
  }, [updateError]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setStatusMessage("");
  }, []);

  const handleSwap = useCallback(() => {
    if (!output) return;
    setInput(output);
    setOutput("");
    updateError(output);
    setStatusMessage("입력/결과 교체 완료");
  }, [output, updateError]);

  const charCount = input.length;
  const lineCount = input ? input.split("\n").length : 0;
  const outputCharCount = output.length;
  const outputLineCount = output ? output.split("\n").length : 0;

  return (
    <TabPage
      helpKey="jsontool"
      toolbar={
        <TooltipProvider>
          {/* Format group */}
          <ToolbarButton
            icon={FileJson}
            label="포맷팅"
            onClick={handleFormat}
            shortcut="Ctrl+Shift+F"
          />
          <Button size="sm" variant="outline" onClick={handleMinify}>
            압축
          </Button>
          <Button size="sm" variant="outline" onClick={handleValidate}>
            검증
          </Button>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Indent setting */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                들여쓰기: {indent}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setIndent(2)}>
                2 spaces
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIndent(4)}>
                4 spaces
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIndent(8)}>
                Tab (8)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Clipboard group */}
          <ToolbarButton
            icon={ClipboardPaste}
            label="붙여넣기"
            onClick={handlePaste}
            shortcut="Ctrl+V"
          />
          <Button size="sm" variant="ghost" onClick={handleSample}>
            샘플
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            지우기
          </Button>
        </TooltipProvider>
      }
      statusBar={
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {statusMessage ||
              (error
                ? "유효하지 않은 JSON"
                : input.trim()
                  ? "유효한 JSON"
                  : "JSON을 입력하세요")}
          </span>
          <span className="ml-auto tabular-nums">
            입력: {charCount}자 {lineCount}줄
            {output && ` | 결과: ${outputCharCount}자 ${outputLineCount}줄`}
          </span>
        </div>
      }
    >

      {/* Error bar */}
      {error && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Line {error.line}, Column {error.column}: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Editors */}
      <ResizablePanelGroup groupRef={groupRef} orientation="horizontal" className="flex-1 min-h-0">
        {/* Input */}
        <ResizablePanel id="jt-input" defaultSize="50" minSize="25">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">입력 JSON</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {charCount}자, {lineCount}줄
              </span>
            </div>
            <div className="flex-1">
              <Editor
                language="json"
                theme={theme === "dark" ? "vs-dark" : "vs"}
                value={input}
                onChange={handleInputChange}
                onMount={(editor) => {
                  inputEditorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: indent,
                  automaticLayout: true,
                  formatOnPaste: true,
                }}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Output */}
        <ResizablePanel id="jt-output" defaultSize="50" minSize="25">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">결과</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={handleSwap}
                  disabled={!output}
                >
                  <ArrowRightLeft className="mr-1 h-3 w-3" />
                  교체
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={handleCopyOutput}
                  disabled={!output}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  복사
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <Editor
                language="json"
                theme={theme === "dark" ? "vs-dark" : "vs"}
                value={output}
                onMount={(editor) => {
                  outputEditorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  readOnly: true,
                  tabSize: indent,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </TabPage>
  );
}
