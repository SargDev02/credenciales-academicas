import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, PageHeading } from "@raes/ui";
import { WebApiError } from "@raes/web-core";
import { getAcademicReview } from "../../../../lib/academic-review-api";
import { getAdminProfile } from "../../../../lib/admin-api";
import { canManage,formatDate } from "../../../../lib/admin-model";
import { blockLabels,compareAcademicData,reviewStateLabels,reviewTone,reviewTypeLabels } from "../../../../lib/academic-review-model";
import { ReviewDecision } from "../../../../components/review-decision";
export const metadata={title:"Revisión académica"};
export default async function ValidationDetail({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 try {
  const [r,profile]=await Promise.all([getAcademicReview(id),getAdminProfile()]);
  const rows=compareAcademicData(r.actual,r.propuesto);
  return <>
   <Link href="/validations">← Validaciones</Link>
   <PageHeading eyebrow={r.institucion.nombre} title={reviewTypeLabels[r.tipo]??r.tipo}>Revisa el contenido antes de incorporarlo al registro oficial.</PageHeading>
   <div className="review-item-header" role="status" aria-live="polite"><Badge size="compact" tone={reviewTone(r.estado)}>{reviewStateLabels[r.estado]}</Badge><span>Detectada {formatDate(r.detectadaAt)}</span></div>
   <p className="review-code">{r.credencialCodigoOrigen??r.personaIdentificadorOrigen}</p>
   {r.bloqueos.map(block=><Alert key={block} title="Cambio que requiere decisión adicional" tone="warning">{blockLabels[block]}</Alert>)}
   {r.estado==="SUPERSEDIDA"&&<Alert title="Solicitud supersedida" tone="warning">La institución reportó información posterior. Esta solicitud ya no puede aprobarse. Consulta las validaciones pendientes.</Alert>}
   {r.motivoDecision&&<Card><h2>Decisión registrada</h2><p>{r.motivoDecision}</p><p className="ui-muted">{formatDate(r.revisadaAt)}</p></Card>}
   <div className="review-comparison" role="region" aria-label="Comparación académica" tabIndex={0}><table>
    <caption>Contenido actual y contenido propuesto. Los campos diferentes se indican con texto.</caption>
    <thead><tr><th scope="col">Campo</th><th scope="col">Actual en RAES</th><th scope="col">Propuesto por institución</th><th scope="col">Comparación</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.path} className={row.changed?"review-row-changed":undefined}><th scope="row">{row.label}</th><td>{row.actual}</td><td>{row.proposed}</td><td>{row.changed?"Diferente":"Sin cambios"}</td></tr>)}</tbody>
   </table></div>
   {r.estado==="PENDIENTE"?(canManage(profile)?<ReviewDecision id={r.id} blocked={r.bloqueos.length>0}/>:<p className="ui-muted">Tu rol AUDITOR permite consultar; la decisión corresponde a ADMIN o SUPERADMIN.</p>):<p className="ui-muted">Esta solicitud ya no admite decisiones.</p>}
  </>;
 }catch(error){if(!(error instanceof WebApiError))throw error;if(error.status===404)notFound();return <Alert title={error.status===403?"Acceso no permitido":"No pudimos cargar la revisión"} tone="danger">{error.message} <Link href="/validations">Volver a validaciones</Link></Alert>;}
}
