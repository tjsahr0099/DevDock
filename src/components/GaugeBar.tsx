import { cn } from "@/lib/utils";

interface GaugeBarProps {
  label: string;
  value: number;
  detail?: string;
  size?: "sm" | "md";
}

export default function GaugeBar({ label, value, detail, size = "md" }: GaugeBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const color =
    clamped > 90 ? "bg-destructive" : clamped > 70 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className={cn("flex items-center gap-2", size === "sm" && "gap-1")}>
      <span className={cn(
        "shrink-0 text-xs font-medium",
        size === "sm" ? "w-8" : "w-12"
      )}>
        {label}
      </span>
      <div className={cn(
        "relative flex-1 overflow-hidden rounded-full bg-secondary",
        size === "sm" ? "h-1.5" : "h-3"
      )}>
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {detail ? (
        <span className={cn(
          "shrink-0 text-right text-xs text-muted-foreground tabular-nums",
          size === "sm" ? "w-10" : "w-20"
        )}>
          {detail}
        </span>
      ) : (
        <span className={cn(
          "shrink-0 text-right text-xs tabular-nums",
          size === "sm" ? "w-8" : "w-10"
        )}>
          {clamped.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
