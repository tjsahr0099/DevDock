import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}

export default function StatCard({ label, value, icon: Icon, color = "text-primary", active, onClick }: StatCardProps) {
  const isClickable = onClick !== undefined;
  const isActive = active ?? true;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors",
        isClickable && "cursor-pointer hover:bg-accent/50",
        isClickable && isActive && "ring-1 ring-primary/50",
        isClickable && !isActive && "opacity-50",
      )}
      onClick={onClick}
    >
      {Icon && (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${color}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}
