/**
 * Modern spinner with bouncing dots + optional label
 */
export function DotSpinner({
  size = "md",
  label,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dotSize = size === "sm" ? "h-1.5 w-1.5" : size === "lg" ? "h-3 w-3" : "h-2 w-2";
  const gap = size === "sm" ? "gap-1" : size === "lg" ? "gap-2" : "gap-1.5";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`flex items-center ${gap}`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${dotSize} rounded-full bg-primary/60`}
            style={{
              animation: "dot-bounce 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
      {label && (
        <span className="text-xs text-muted-foreground animate-pulse">{label}</span>
      )}
    </div>
  );
}

/**
 * Ring spinner with gradient trail
 */
export function RingSpinner({
  size = "md",
  label,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dim = size === "sm" ? 20 : size === "lg" ? 36 : 28;
  const stroke = size === "sm" ? 2.5 : size === "lg" ? 3.5 : 3;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={dim}
        height={dim}
        className="animate-[ring-spin_1s_linear_infinite]"
      >
        {/* Track */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted-foreground/15"
        />
        {/* Arc */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="url(#spinner-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
        />
        <defs>
          <linearGradient id="spinner-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
