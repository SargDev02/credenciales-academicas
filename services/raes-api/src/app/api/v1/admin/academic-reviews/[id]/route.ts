import { readAcademicReview } from "@/lib/academic-review";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return readAcademicReview(request, (await context.params).id); }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
