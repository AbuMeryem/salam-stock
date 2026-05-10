import { cn } from "@/lib/utils/cn";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin",
        className
      )}
    />
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <LoadingSpinner className="w-7 h-7" />
    </div>
  );
}
