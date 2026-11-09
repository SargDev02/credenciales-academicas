import type { ReviewState } from "@raes/contracts";
export const reviewTypeLabels: Record<string,string> = {
 NUEVO_ESTUDIANTE:"Nuevo estudiante", ACTUALIZACION_ESTUDIANTE:"Actualización de estudiante",
 NUEVA_CREDENCIAL:"Nueva credencial", ACTUALIZACION_CREDENCIAL:"Actualización de credencial",
};
export const reviewStateLabels: Record<ReviewState,string> = {PENDIENTE:"Pendiente",APROBADA:"Aprobada",RECHAZADA:"Rechazada",SUPERSEDIDA:"Supersedida"};
const labels: Record<string,string> = {
 persona:"Estudiante",contenido:"Credencial",programa:"Programa",sede:"Sede",relacion:"Oferta académica",
 tipoDocumento:"Tipo de documento",numeroDocumento:"Documento",primerNombre:"Primer nombre",segundoNombre:"Segundo nombre",primerApellido:"Primer apellido",segundoApellido:"Segundo apellido",
 codigoOrigen:"Código institucional",codigoSnies:"Código SNIES",nombre:"Nombre",nivelFormacion:"Nivel de formación",modalidad:"Modalidad",facultad:"Facultad",
 departamento:"Departamento",municipio:"Municipio",direccion:"Dirección",jornada:"Jornada",estado:"Estado reportado",
 tipo:"Tipo",categoria:"Categoría",titulo:"Título",descripcion:"Descripción",fechaEmision:"Fecha de emisión",fechaGrado:"Fecha de grado",numeroActa:"Acta",numeroFolio:"Folio",numeroLibro:"Libro",documentoHashSha256:"Hash documental",programaCodigoOrigen:"Código de programa",sedeCodigoOrigen:"Código de sede",
};
export function fieldLabel(path: string): string {
 return path.replace(/credenciales\.(\d+)/g,(_,n)=>`Credencial ${Number(n)+1}`).split(".").map(k=>labels[k]??k).join(" · ");
}
export function reviewTone(state: ReviewState): "success"|"danger"|"warning"|"neutral" { return state==="APROBADA"?"success":state==="RECHAZADA"?"danger":state==="PENDIENTE"?"warning":"neutral"; }
export function compareAcademicData(actual: Record<string,unknown>,proposed: Record<string,unknown>) {
 function flatten(value: unknown,prefix="",result=new Map<string,string>()): Map<string,string> {
  if(value!==null&&typeof value==="object") {
   for(const [key,item]of Object.entries(value)) {
    if(["sourceUpdatedAt","identificadorOrigen","personaIdentificadorOrigen"].includes(key))continue;
    flatten(item,prefix?`${prefix}.${key}`:key,result);
   }
  }else result.set(prefix,value===null||value===undefined?"Sin dato":String(value));
  return result;
 }
 const a=flatten(actual),p=flatten(proposed);
 return [...new Set([...a.keys(),...p.keys()])].sort((x,y)=>{
  const group=(s:string)=>s.startsWith("persona.")?0:1;return group(x)-group(y)||x.localeCompare(y,"es");
 }).map(path=>({path,label:fieldLabel(path),actual:a.get(path)??"Sin dato",proposed:p.get(path)??"Sin dato",changed:a.get(path)!==p.get(path)}));
}
export const blockLabels: Record<string,string> = {
 ESTADO_TERMINAL:"REQUIERE DECISIÓN: RAES no permite reactivar ni corregir una credencial revocada o anulada. Puedes rechazar la propuesta; su historial se conserva.",
 CAMBIO_IDENTIDAD:"REQUIERE DECISIÓN: el cambio pretende reasignar una identidad documental existente y no puede aprobarse mediante este flujo.",
 CANONICO_MODIFICADO:"El registro oficial cambió después de la detección. Se necesita una nueva detección y revisión antes de aprobar.",
};
