import { recoveryFlowId } from "@raes/web-core/recovery";
import { siteOrigin } from "@raes/web-core/deployment";
import { NextResponse } from "next/server";
import { createWebAuth } from "../../../lib/auth";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const site = new URL(
    siteOrigin(process.env, "CREDENLY"),
  ).origin;
  if (code && code.length <= 2048) {
    const rawFlowId=new URL(request.url).searchParams.get("sb_flow_id");
    if(rawFlowId && !recoveryFlowId(rawFlowId))return NextResponse.redirect(new URL("/login?confirmation=failed",site));
    const auth = await createWebAuth(true);
    const flowId=recoveryFlowId(new URL(request.url).searchParams.get("sb_flow_id"));
    let recovering=false;
    const {data:listener}=auth.auth.onAuthStateChange(event=>{if(event==="PASSWORD_RECOVERY")recovering=true;});
    const { error } = await auth.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined).finally(()=>listener.subscription.unsubscribe());
    if(recovering) { await auth.auth.signOut({scope:"local"}); return NextResponse.redirect(new URL("/forgot-password",site)); }
    if (!error)
      return NextResponse.redirect(new URL("/onboarding", site), {
        headers: { "Cache-Control": "private, no-store" },
      });
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", site), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
