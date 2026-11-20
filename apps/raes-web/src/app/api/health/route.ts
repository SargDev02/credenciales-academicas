export const dynamic="force-dynamic";
export function GET() { return Response.json({status:"ok",service:"raes-web"},{headers:{"Cache-Control":"private, no-store"}}); }
