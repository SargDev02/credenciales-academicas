import Link from "next/link";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeading } from "@raes/ui";
import { reviewFiltersSchema } from "@raes/contracts";
import { WebApiError } from "@raes/web-core";
import { getAcademicReviews } from "../../../lib/academic-review-api";
import { getInstitutions } from "../../../lib/admin-api";
import { formatDate } from "../../../lib/admin-model";
import { fieldLabel, reviewStateLabels, reviewTone, reviewTypeLabels } from "../../../lib/academic-review-model";
export const metadata={title:"Validaciones académicas"};
export default async function Validations({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const params=Object.fromEntries(Object.entries(await searchParams).filter(([,value])=>value!==""&&value!==undefined)),parsed=reviewFiltersSchema.safeParse({...params,estado:params.estado??"PENDIENTE"});
 if(!parsed.success)return <Alert title="Filtros no válidos" tone="danger">Revisa los filtros y la paginación. <Link href="/validations">Restablecer consulta</Link></Alert>;
 const filters=parsed.data;
 try {
  const [result,institutions]=await Promise.all([getAcademicReviews(filters),getInstitutions()]);
  const pageHref=(page:number)=>`/validations?${new URLSearchParams(Object.entries({...filters,page}).map(([k,v])=>[k,String(v)]))}`;
  return <>
   <PageHeading eyebrow="REVISIÓN ACADÉMICA" title="Validaciones">Las instituciones proponen cambios. RAES decide qué incorporar al registro oficial.</PageHeading>
   <form className="review-filters" action="/validations">
    <div className="ui-field"><label htmlFor="review-state">Estado</label><select id="review-state" name="estado" defaultValue={filters.estado} className="ui-input">{Object.entries(reviewStateLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
    <div className="ui-field"><label htmlFor="review-type">Tipo</label><select id="review-type" name="tipo" defaultValue={filters.tipo??""} className="ui-input"><option value="">Todos los tipos</option>{Object.entries(reviewTypeLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
    <div className="ui-field"><label htmlFor="review-institution">Institución</label><select id="review-institution" name="institucion" defaultValue={filters.institucion??""} className="ui-input"><option value="">Todas las instituciones</option>{institutions.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>
    <Input id="review-query" name="q" label="Código o identificador" maxLength={150} defaultValue={filters.q??""}/>
    <Input id="review-from" name="desde" type="date" label="Desde" defaultValue={filters.desde??""}/><Input id="review-to" name="hasta" type="date" label="Hasta" defaultValue={filters.hasta??""}/>
    <Button type="submit">Aplicar filtros</Button><Link href="/validations">Restablecer</Link>
   </form>
   <p className="ui-muted">{result.meta.total} solicitudes · Página {result.meta.page}</p>
   {result.data.length?<div className="review-list">{result.data.map(r=><Card key={r.id}>
     <div className="review-item-header"><h2>{reviewTypeLabels[r.tipo]}</h2><Badge size="compact" tone={reviewTone(r.estado)}>{reviewStateLabels[r.estado]}</Badge></div>
     <p><strong>{r.institucion.nombre}</strong> · {r.personaNombre||"Estudiante propuesto"}</p>
     <p className="review-code">{r.credencialCodigoOrigen??r.identificadorOrigen}</p>
     <p className="ui-muted">{r.camposModificados.map(fieldLabel).join(" · ")||"Incorporación académica"}</p>
     <div className="review-item-footer"><span>Detectada {formatDate(r.detectadaAt)}</span><Link href={`/validations/${r.id}`}>Revisar solicitud →</Link></div>
    </Card>)}</div>:<Card><EmptyState title="Sin solicitudes para estos filtros">Las novedades reportadas por las instituciones aparecerán aquí. Los registros anteriores al baseline siguen aprobados.</EmptyState></Card>}
   <nav className="review-pagination" aria-label="Páginas de validaciones">{filters.page>1&&<Link href={pageHref(filters.page-1)}>← Anterior</Link>}{filters.page*filters.pageSize<result.meta.total&&<Link href={pageHref(filters.page+1)}>Siguiente →</Link>}</nav>
  </>;
 }catch(error){if(!(error instanceof WebApiError))throw error;return <Alert title={error.status===403?"Acceso no permitido":"Validaciones no disponibles"} tone="danger">{error.message} <Link href="/validations">Volver a consultar</Link></Alert>;}
}
