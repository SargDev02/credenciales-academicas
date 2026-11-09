import { controlDetection } from "@/lib/academic-review";
export const POST = (request: Request) => controlDetection(request);
export const DELETE = (request: Request) => controlDetection(request, true);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
