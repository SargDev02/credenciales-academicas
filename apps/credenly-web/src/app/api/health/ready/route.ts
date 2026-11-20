import { getWebConfig } from "@/lib/env";
export const dynamic="force-dynamic";
export async function GET() {
 try {
  const config=getWebConfig();
  const upstream=await fetch(new URL('/api/v1/health/ready',config.apiBase),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
  return Response.json({status:upstream.ok?'ready':'not_ready',service:'credenly-web',components:{api:upstream.ok?'up':'down'}},{status:upstream.ok?200:503});
 }catch{return Response.json({status:'not_ready',service:'credenly-web',components:{configurationOrApi:'unavailable'}},{status:503});}
}
