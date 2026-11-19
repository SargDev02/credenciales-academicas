import Link from 'next/link';
import {EmptyState} from '@raes/ui';
export default function ReviewNotFound(){return <EmptyState title="Solicitud no disponible" action={<Link href="/validations">Volver a validaciones</Link>}>La revisión solicitada no existe o ya no está disponible.</EmptyState>;}
