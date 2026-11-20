import { internalAdmission } from "@raes/web-core/admission";
export const runtime = "nodejs";
export async function POST(request: Request) { return internalAdmission(request,"RAES"); }
