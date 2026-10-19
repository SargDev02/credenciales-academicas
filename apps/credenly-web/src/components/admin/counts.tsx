import { Card } from "@raes/ui";
import type { Counts } from "../../lib/admin-model";
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
    <Card>
      <div className="operations-section-heading">
        <h2>{title}</h2>
        <p>
          Total: <strong>{counts.total}</strong>
        </p>
      </div>
      <dl className="operations-counts">
        {Object.entries(labels).map(([state, label]) => (
          <div key={state}>
            <dt>{label}</dt>
            <dd>{counts.byState[state]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
