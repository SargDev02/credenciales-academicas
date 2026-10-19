import { PageHeading } from "@raes/ui";
import { formatAdminTimestamp } from "../../lib/admin-presentation";
import { RefreshControl } from "./refresh-control";
export function AdminHeading({
  title,
  description,
  observedAt,
}: {
  title: string;
  description: string;
  observedAt?: string;
}) {
  return (
    <div className="operations-heading">
      <div>
        <PageHeading title={title}>{description}</PageHeading>
        {observedAt && (
          <p className="operations-timestamp">
            Última consulta{" "}
            <time dateTime={observedAt}>
              {formatAdminTimestamp(observedAt)}
            </time>
          </p>
        )}
      </div>
      <RefreshControl />
    </div>
  );
}
