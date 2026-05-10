import { ArrowDown, ArrowUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EcartBadge({ value }: { value: number }) {
  const abs = Math.abs(value);
  if (abs < 0.5) {
    return (
      <span className="badge badge-success">
        <CheckCircle2 className="w-3 h-3" /> Conforme
      </span>
    );
  }
  const danger = abs > 5;
  return (
    <span className={cn("badge", danger ? "badge-danger" : "badge-warning")}>
      {value > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      Écart {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}
