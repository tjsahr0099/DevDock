import { cn } from "@/lib/utils";

type StatusDotVariant = "online" | "offline" | "warning" | "loading";

interface StatusDotProps {
  variant: StatusDotVariant;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<StatusDotVariant, string> = {
  online: "bg-green-500",
  offline: "bg-muted-foreground",
  warning: "bg-yellow-500",
  loading: "bg-blue-500",
};

export default function StatusDot({ variant, pulse = false, className }: StatusDotProps) {
  return (
    <span className={cn("relative flex h-2.5 w-2.5 shrink-0", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-50",
            variantStyles[variant],
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          variantStyles[variant],
        )}
      />
    </span>
  );
}
