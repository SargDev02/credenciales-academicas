import "server-only";
import { apiRequest } from "@raes/web-core";
import { reviewFiltersSchema, reviewListResponseSchema, reviewDetailResponseSchema, type ReviewFilters } from "@raes/contracts";
import { getWebConfig } from "./env";
import { requireSession } from "./auth";
export async function getAcademicReviews(filters: Partial<ReviewFilters> = {}) {
 const parsed=reviewFiltersSchema.parse(filters),{token}=await requireSession();
 return apiRequest(getWebConfig().apiBase,"/api/v1/admin/academic-reviews",{token,query:Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,String(v)])),validate:(v):v is ReturnType<typeof reviewListResponseSchema.parse>=>reviewListResponseSchema.safeParse(v).success});
}
export async function getAcademicReview(id:string) {
 const {token}=await requireSession();
 return (await apiRequest(getWebConfig().apiBase,`/api/v1/admin/academic-reviews/${encodeURIComponent(id)}`,{token,validate:(v):v is ReturnType<typeof reviewDetailResponseSchema.parse>=>reviewDetailResponseSchema.safeParse(v).success})).data;
}
