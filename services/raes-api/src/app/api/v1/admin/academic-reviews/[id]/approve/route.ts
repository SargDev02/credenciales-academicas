import { decideAcademicReview } from "@/lib/academic-review";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return decideAcademicReview(request, (await context.params).id, "APROBAR"); }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
