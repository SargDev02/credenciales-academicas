import Link from "next/link";
import { Card } from "@raes/ui";
import { PasswordForm } from "../../../../components/admin-password-forms";
export const dynamic="force-dynamic";
export default async function RecoveryPage({searchParams}:{searchParams:Promise<{code?:string;sb_flow_id?:string}>}) {
 const params=await searchParams;
 return <main id="main-content" className="citizen-auth login-panel"><Card><h1>Verificar enlace de recuperación</h1><PasswordForm step="exchange" {...(params.code?{code:params.code}:{})} {...(params.sb_flow_id?{flowId:params.sb_flow_id}:{})}/><p><Link href="/admin/login">Volver al inicio de sesión</Link></p></Card></main>;
}
