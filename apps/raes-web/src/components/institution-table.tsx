import Link from "next/link";
import { Status } from "./status";
import type { Institution } from "../lib/admin-model";
export function InstitutionTable({ rows }: { rows: Institution[] }) {
  return (
    <div
      className="admin-table-region"
      tabIndex={0}
      role="region"
      aria-label="Tabla de instituciones"
    >
      <table className="admin-table">
        <caption className="ui-visually-hidden">
          Instituciones consultadas desde RAES
        </caption>
        <thead>
          <tr>
            <th scope="col">Institución</th>
            <th scope="col">NIT</th>
            <th scope="col">Estado</th>
            <th scope="col">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td data-label="Institución">
                <strong>{i.nombre}</strong>
                <span className="table-secondary">{i.tipoInstitucion}</span>
              </td>
              <td data-label="NIT">{i.nit}</td>
              <td data-label="Estado">
                <Status value={i.estado} />
              </td>
              <td data-label="Detalle">
                <Link
                  href={`/institutions/${encodeURIComponent(i.id)}`}
                  aria-label={`Ver detalle de ${i.nombre}`}
                >
                  Ver detalle ↗
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
