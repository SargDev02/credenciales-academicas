import { Badge } from "@raes/ui";
import { statusLabel, statusTone } from "../lib/admin-model";
export function Status({ value }: { value: string }) {
  return (
    <Badge size="compact" tone={statusTone(value)}>
      {statusLabel(value)}
    </Badge>
  );
}
