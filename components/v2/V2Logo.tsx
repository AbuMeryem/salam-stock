interface V2LogoProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export function V2Logo({ size = 28, variant = "light", className = "" }: V2LogoProps) {
  const bg = variant === "dark" ? "var(--accent-gold-bright)" : "var(--primary-green)";
  const fg = variant === "dark" ? "var(--primary-green-dark)" : "var(--accent-gold-bright)";
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center shrink-0 rounded-[10px] font-extrabold tracking-tight ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.46),
        lineHeight: 1,
        letterSpacing: "-0.04em",
      }}
    >
      S
    </span>
  );
}
