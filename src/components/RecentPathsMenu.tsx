import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";

interface PathInputWithHistoryProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  recentPaths: string[];
  onSelect: (path: string) => void;
  placeholder?: string;
}

export default function PathInputWithHistory({
  value,
  onChange,
  onSubmit,
  recentPaths,
  onSelect,
  placeholder,
}: PathInputWithHistoryProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative flex-1 flex" ref={ref}>
      <div className="flex flex-1 items-center">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(value);
          }}
          placeholder={placeholder}
          className="h-8 flex-1 text-sm rounded-r-none border-r-0"
        />
        <button
          className={`h-8 px-1.5 border border-input rounded-r-md hover:bg-accent transition-colors ${
            open ? "bg-accent" : "bg-transparent"
          }`}
          onClick={() => {
            if (recentPaths.length > 0) setOpen((o) => !o);
          }}
          disabled={recentPaths.length === 0}
          title="최근 경로"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      {open && recentPaths.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-0.5 z-50 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {recentPaths.map((p) => (
            <button
              key={p}
              className={`w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-accent truncate block ${
                p === value ? "bg-accent/50" : ""
              }`}
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
              title={p}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
