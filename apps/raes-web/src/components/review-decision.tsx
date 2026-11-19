"use client";
import { useRef,useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Alert } from "@raes/ui";
import { decideReview } from "../lib/academic-review-actions";
export function ReviewDecision({id,blocked}:{id:string;blocked:boolean}) {
 const dialog=useRef<HTMLDialogElement>(null),router=useRouter();
 const [mode,setMode]=useState<"approve"|"reject">("approve"),[error,setError]=useState(""),[message,setMessage]=useState(""),[pending,startTransition]=useTransition();
 function open(action:"approve"|"reject") {setMode(action);setError("");dialog.current?.showModal();}
 return <section className="review-decisions" aria-label="Decisión administrativa">
  {message&&<p role="status">{message}</p>}
  <div className="ui-actions"><Button onClick={()=>open("approve")} disabled={blocked||pending}>Aceptar</Button><Button variant="secondary" onClick={()=>open("reject")} disabled={pending}>Rechazar</Button><Button variant="secondary" onClick={()=>router.refresh()} disabled={pending}>Actualizar revisión</Button></div>
  {blocked&&<p className="ui-hint">La aprobación está bloqueada por las reglas de RAES indicadas arriba.</p>}
  <dialog ref={dialog} aria-labelledby="review-confirm-title" aria-describedby="review-confirm-description" className="review-dialog" onCancel={e=>{if(pending)e.preventDefault();}}>
   <h2 id="review-confirm-title">{mode==="approve"?"Aceptar cambio académico":"Rechazar solicitud"}</h2>
   <p id="review-confirm-description">{mode==="approve"?"Esta acción incorporará el cambio al registro oficial RAES.":"El rechazo conservará el registro oficial sin cambios. Debes explicar el motivo."}</p>
   <form onSubmit={event=>{
    event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget),reason=mode==="approve"?"Aprobación administrativa de cambio académico":String(data.get("motivo")??"");setError("");
    startTransition(async()=>{const result=await decideReview(id,mode,reason);if(result.error){setError(result.error);return;}setMessage(result.message??"Decisión registrada.");dialog.current?.close();router.refresh();});
   }}>
    {mode==="reject"&&<div className="ui-field"><label htmlFor="review-reason">Motivo del rechazo</label><textarea id="review-reason" name="motivo" required minLength={3} maxLength={1000} rows={4} disabled={pending} className="ui-input" /></div>}
    {error&&<Alert title="No se pudo registrar la decisión" tone="danger">{error}</Alert>}
    <div className="ui-actions"><Button type="submit" busy={pending}>{mode==="approve"?"Sí, incorporar cambio":"Confirmar rechazo"}</Button><Button variant="secondary" disabled={pending} onClick={()=>dialog.current?.close()}>Cancelar</Button></div>
   </form>
  </dialog>
 </section>;
}
