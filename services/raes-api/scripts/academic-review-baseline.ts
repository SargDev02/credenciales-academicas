import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { type SupabaseClient } from "@supabase/supabase-js";
import { buildAcademicObservations, createInstitutionSourceClient, readInstitutionalSnapshot, toProgram, toCampus, toProgramCampus } from "@raes/connector-core";
import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";

// Operator-only. --check performs only GETs against the existing schema and works
// before the review migration is installed. No fingerprints/documents are logged.
const args = process.argv.slice(2).filter(v => v !== "--");
if (args.some(v => v !== "--check")) throw new Error("Usage: academic-review:baseline [--check]");
const check = args.includes("--check");
Object.assign(process.env, parse(readFileSync(resolve(".env.local"), "utf8")));
const db = getRaesSupabaseAdmin();
async function all(client: SupabaseClient, table: string, columns: string, institutionId: string) {
  const result: Record<string, unknown>[] = [];
  for (let start = 0; ; start += 1000) {
    const r = await client.from(table).select(columns).eq("institucion_id", institutionId).order("id").range(start,start+999);
    if (r.error || !r.data) throw new Error("No fue posible comparar las referencias RAES");
    result.push(...r.data as unknown as Record<string, unknown>[]);
    if (r.data.length < 1000) return result;
  }
}
let stage="CONFIG";
async function main() {
  const prepared = [];
  for (const prefix of ["POLI","UDEA"]) {
    const sourceEnv = parse(readFileSync(resolve(`../connector-${prefix.toLowerCase()}/.env.local`),"utf8"));
    const source = createInstitutionSourceClient({supabaseUrl:sourceEnv[`${prefix}_SUPABASE_URL`]!,serviceRoleKey:sourceEnv[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`]!});
    stage=`READ_${prefix}`;
    const snapshot = await readInstitutionalSnapshot(source), observations = buildAcademicObservations(snapshot);
    stage=`COMPARE_${prefix}`;
    const institution = await db.from("instituciones").select("id").eq("nit",snapshot.institution.nit).maybeSingle();
    if(institution.error || !institution.data)throw new Error("La institución de origen no está registrada en RAES");
    const integration = await db.from("integraciones_institucionales").select("id").eq("institucion_id",institution.data.id).eq("client_id",sourceEnv[`RAES_${prefix}_CLIENT_ID`]).eq("estado","ACTIVA").maybeSingle();
    if(integration.error || !integration.data)throw new Error("La integración no corresponde a la institución");
    const [people,credentials,programs,campuses] = await Promise.all([
      all(db,"persona_fuentes","id,persona_id,identificador_origen,tipo_documento_reportado,numero_documento_reportado,personas_maestra(tipo_documento,numero_documento)",institution.data.id),
      all(db,"credenciales","id,persona_id,codigo_origen",institution.data.id),
      all(db,"programas","id,codigo_origen",institution.data.id),all(db,"sedes","id,codigo_origen",institution.data.id),
    ]);
    const desconocidos: {entidad:string;origen:string}[]=[];
    for(const o of observations) {
      const person=people.find(v=>v.identificador_origen===o.persona.identificadorOrigen);
      const raw=person?.personas_maestra as Record<string,unknown>|Record<string,unknown>[]|undefined;
      const master=Array.isArray(raw)?raw[0]:raw;
      if(!person || master?.tipo_documento!==o.persona.tipoDocumento || master?.numero_documento!==o.persona.numeroDocumento)desconocidos.push({entidad:"ESTUDIANTE",origen:o.persona.identificadorOrigen});
      for(const c of o.credenciales)if(!credentials.some(v=>v.codigo_origen===c.contenido.codigoOrigen&&v.persona_id===person?.persona_id))desconocidos.push({entidad:"CREDENCIAL",origen:c.identificadorOrigen});
    }
    const catalogos={
      programas:snapshot.programs.map(p=>({identificadorOrigen:p.id,payload:toProgram(p),sourceUpdatedAt:p.updated_at??null})),
      sedes:snapshot.campuses.map(c=>({identificadorOrigen:c.id,payload:toCampus(c),sourceUpdatedAt:c.updated_at??null})),
      relaciones:snapshot.programCampuses.map(r=>({identificadorOrigen:r.id,sourceUpdatedAt:r.updated_at??null,payload:toProgramCampus(r,snapshot.programs.find(p=>p.id===r.programa_id)!,snapshot.campuses.find(c=>c.id===r.sede_id)!)})),
    };
    for(const p of catalogos.programas)if(!programs.some(v=>v.codigo_origen===p.payload.codigoOrigen))desconocidos.push({entidad:"PROGRAMA",origen:p.identificadorOrigen});
    for(const c of catalogos.sedes)if(!campuses.some(v=>v.codigo_origen===c.payload.codigoOrigen))desconocidos.push({entidad:"SEDE",origen:c.identificadorOrigen});
    const relations: {programa_id:string;sede_id:string}[]=[];
    if(programs.length>1000)throw new Error("El catálogo excede el límite del operador de baseline");
    if(programs.length)for(let start=0;;start+=1000){
      const r=await db.from("programa_sede").select("id,programa_id,sede_id").in("programa_id",programs.map(v=>String(v.id))).order("id").range(start,start+999);
      if(r.error||!r.data)throw new Error("No fue posible comprobar las relaciones académicas");
      relations.push(...r.data);if(r.data.length<1000)break;
    }
    for(const rel of catalogos.relaciones){
      const program=programs.find(v=>v.codigo_origen===rel.payload.programaCodigoOrigen),campus=campuses.find(v=>v.codigo_origen===rel.payload.sedeCodigoOrigen);
      if(!relations.some(v=>v.programa_id===program?.id&&v.sede_id===campus?.id))desconocidos.push({entidad:"PROGRAMA_SEDE",origen:rel.identificadorOrigen});
    }
    const summary={institution:prefix,ready:desconocidos.length===0,cantidades:{ESTUDIANTE:observations.length,CREDENCIAL:snapshot.credentials.length,PROGRAMA:catalogos.programas.length,SEDE:catalogos.sedes.length,PROGRAMA_SEDE:catalogos.relaciones.length},desconocidos};
    console.log(JSON.stringify({...summary,checkOnly:check}));
    prepared.push({summary,observations,catalogos,integrationId:integration.data.id});
  }
  // Both institutions must pass preflight before writing either baseline.
  if(prepared.some(p=>!p.summary.ready)){process.exitCode=1;return;}
  if(check)return;
  for(const p of prepared) {
    const result=await db.rpc("preparar_baseline_revision_academica",{p_integracion_id:p.integrationId,p_observaciones:p.observations,p_catalogos:p.catalogos,p_check:false});
    if(result.error || !result.data?.ready)throw new Error("El baseline no se aplicó: referencias cambiantes o migración pendiente; revisar antes de reintentar");
    console.log(JSON.stringify({institution:p.summary.institution,baseline:result.data}));
  }
}
main().catch(()=>{console.error("No fue posible completar el baseline",{code:"BASELINE_CHECK_FAILED",stage});process.exitCode=1;});
