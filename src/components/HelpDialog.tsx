import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CircleHelp } from "lucide-react";

const HELP_FILES: Record<string, string> = {
  dbdoc: "db-definition-generator.md",
  pumlviewer: "puml-viewer-help.md",
  mdviewer: "md-viewer-help.md",
  callflow: "callflow-help.md",
  servermanager: "server-manager-help.md",
  servermonitor: "server-monitor-help.md",
  jsontool: "json-tool-help.md",
};

interface HelpDialogProps {
  helpKey: string;
}

export default function HelpDialog({ helpKey }: HelpDialogProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) return;
    const file = HELP_FILES[helpKey];
    if (!file) {
      setContent("도움말을 찾을 수 없습니다.");
      return;
    }
    fetch(`/docs/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      })
      .then(setContent)
      .catch(() => setContent("도움말 파일을 불러올 수 없습니다."));
  }, [open, helpKey]);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-3.5 w-3.5" />
        도움말
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[50vw]">
          <DialogHeader>
            <DialogTitle>도움말</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-6rem)]">
            <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
