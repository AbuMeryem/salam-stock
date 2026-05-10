import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  initials: string;
  online?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
};

const dotSizes = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3.5 h-3.5",
};

export function Avatar({ initials, online, size = "md", className }: AvatarProps) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <div
        className={cn(
          "rounded-full bg-gold flex items-center justify-center font-bold text-primary-dark shadow-card",
          sizes[size]
        )}
      >
        {initials}
      </div>
      {online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-white",
            dotSizes[size]
          )}
        />
      )}
    </div>
  );
}
