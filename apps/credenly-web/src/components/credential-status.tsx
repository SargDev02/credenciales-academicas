import { Badge } from "@raes/ui";
import { statusText } from "../lib/citizen-model";
export function CredentialStatus({ state }: { state: string }) {
  return (
    <Badge
      size="compact"
      tone={
        state === "VIGENTE" || state === "APROBADA" || state === "ACTIVA"
          ? "success"
          : state === "REVOCADA" || state === "RECHAZADA"
            ? "danger"
            : "warning"
      }
    >
      {statusText(state)}
    </Badge>
  );
}
