"use client";
import Link from "next/link";
import { Alert, Button } from "@raes/ui";
export default function ErrorPage({ reset }: { reset: () => void }) { return <Alert title="No pudimos completar la consulta operativa" tone="danger"><p>Comprueba el acceso y la disponibilidad del servicio.</p><Button variant="secondary" onClick={reset}>Volver a intentar</Button><Link href="/admin/login">Acceso administrativo</Link></Alert>; }
