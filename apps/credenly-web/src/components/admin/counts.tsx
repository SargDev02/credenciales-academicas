import { Badge, Card } from "@raes/ui";
import type { Counts } from "../../lib/admin-model";
import { stateTone } from "../../lib/admin-presentation";
export function StateCounts({
  title,
  labels,
  counts,
}: {
  title: string;
  labels: Record<string, string>;
  counts: Counts;
}) {
  return (
    <Card className="operations-state-panel">
      <div className="operations-section-heading">
        <h2>{title}</h2>
        <p className="operations-state-total">
          Total<strong>{counts.total.toLocaleString("es-CO")}</strong>
        </p>
      </div>
      <ul className="operations-state-grid">
        {Object.entries(labels).map(([state, label]) => (
          <li key={state}>
            <Badge size="compact" tone={stateTone(state)}>
              {state}
            </Badge>
            <strong>
              {counts.byState[state]!.toLocaleString("es-CO")}
              <span className="ui-visually-hidden"> {label}</span>
            </strong>
            <p>{label}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
