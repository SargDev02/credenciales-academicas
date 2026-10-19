import Link from "next/link";
import { Alert, Card } from "@raes/ui";
import { AdminLoginForm } from "../../../components/admin/login-form";
import { getWebConfig } from "../../../lib/env";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso administrativo" };
export default function AdminLogin() {
  let configured = true; try { getWebConfig(); } catch { configured = false; }
  return <main id="main-content" className="operations-login"><div><Link className="citizen-wordmark" href="/admin">Credenly<span>ADMINISTRACIÓN OPERATIVA</span></Link><p className="ui-eyebrow">ACCESO RESTRINGIDO</p><h1>Supervisión del servicio ciudadano.</h1><p>Consulta disponibilidad y estados operativos con permisos administrativos independientes.</p><Link href="/login">Volver al acceso ciudadano</Link></div><Card><h2>Acceso administrativo</h2><p className="ui-muted">El acceso depende del perfil y rol de tu cuenta, no del nombre de tu correo.</p>{configured ? <AdminLoginForm /> : <Alert title="Acceso pendiente de configuración" tone="warning">Configura Auth y Credenly API para continuar.</Alert>}</Card></main>;
}
