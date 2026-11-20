"use client";
import { useActionState } from "react";
import { Alert, Button, Input } from "@raes/ui";
import { requestRecovery, exchangeRecovery, finishRecovery } from "../lib/admin-recovery-actions";
export function PasswordForm({step,code,flowId}:{step:'request'|'exchange'|'reset';code?:string;flowId?:string}) {
 const [state,action,pending]=useActionState(step==='request'?requestRecovery:step==='exchange'?exchangeRecovery:finishRecovery,{});
 return <form action={action} aria-busy={pending} className="login-form citizen-form">
  {step==='request'&&<Input id="recovery-email" label="Correo electrónico" name="email" type="email" required maxLength={254} autoComplete="email"/>}
  {step==='exchange'&&<><input type="hidden" name="code" value={code??''}/><input type="hidden" name="sb_flow_id" value={flowId??''}/><p>Continúa para verificar el enlace. Debes usar el navegador donde lo solicitaste.</p></>}
  {step==='reset'&&!state.done&&<><Input id="new-password" name="password" label="Nueva contraseña" type="password" minLength={12} maxLength={256} autoComplete="new-password" required/><Input id="confirm-password" name="confirmation" label="Confirmar contraseña" type="password" minLength={12} maxLength={256} autoComplete="new-password" required/></>}
  {state.error&&<Alert title="No se pudo completar" tone="danger">{state.error}</Alert>}
  {state.message&&<Alert title="Recuperación de contraseña" tone="success">{state.message}</Alert>}
  {!state.done&&<Button type="submit" busy={pending}>{step==='request'?'Solicitar enlace':step==='exchange'?'Continuar con recuperación':'Guardar nueva contraseña'}</Button>}
 </form>;
}
