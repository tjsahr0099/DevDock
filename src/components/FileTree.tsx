import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedPath === node.path;

  if (node.is_dir) {
    return (
      <div>
        <button
          className={cn(
            "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-sm hover:bg-accent",
            isSelected && "bg-accent",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-sm hover:bg-accent",
        isSelected && "bg-accent text-accent-foreground font-medium",
      )}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => onSelect(node.path)}
    >
      <span className="h-3.5 w-3.5 shrink-0" />
      <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function FileTree({
  nodes,
  selectedPath,
  onSelect,
}: FileTreeProps) {
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            파일이 없습니다
          </div>
        ) : (
          <div className="p-1">
            {nodes.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
