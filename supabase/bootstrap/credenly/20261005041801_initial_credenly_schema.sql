
create extension if not exists pgcrypto;

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombres varchar(160),
  apellidos varchar(160),
  estado varchar(30) not null default 'PENDIENTE_VERIFICACION'
    check (estado in ('PENDIENTE_VERIFICACION','ACTIVO','SUSPENDIDO','CERRADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verificaciones_identidad (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo_documento_extraido varchar(20),
  numero_documento_extraido varchar(50),
  nombres_extraidos varchar(200),
  apellidos_extraidos varchar(200),
  confianza_ocr numeric(5,4)
    check (confianza_ocr is null or (confianza_ocr >= 0 and confianza_ocr <= 1)),
  estado varchar(20) not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','PROCESADA','APROBADA','RECHAZADA','REVISION')),
  motivo_fallo text,
  imagen_path text,
  processed_at timestamptz,
  imagen_eliminada_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.vinculaciones_raes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  raes_persona_id uuid not null unique,
  verificacion_identidad_id uuid unique
    references public.verificaciones_identidad(id) on delete restrict,
  estado varchar(20) not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','VERIFICADA','RECHAZADA','REVOCADA')),
  metodo_verificacion varchar(30) not null default 'OCR_DOCUMENTO'
    check (metodo_verificacion in ('OCR_DOCUMENTO')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comparticiones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  raes_credencial_id uuid not null,
  token_prefix varchar(16) not null,
  token_hash varchar(64) not null unique check (length(token_hash) = 64),
  campos_visibles jsonb not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.accesos_compartidos (
  id uuid primary key default gen_random_uuid(),
  comparticion_id uuid not null references public.comparticiones(id) on delete cascade,
  resultado varchar(40) not null
    check (resultado in ('OK','ENLACE_EXPIRADO','ENLACE_REVOCADO','CREDENCIAL_NO_DISPONIBLE','ERROR')),
  ip_hash varchar(64) check (ip_hash is null or length(ip_hash) = 64),
  user_agent text,
  accessed_at timestamptz not null default now()
);

create index idx_verificaciones_usuario on public.verificaciones_identidad(usuario_id, created_at desc);
create index idx_vinculaciones_raes_persona on public.vinculaciones_raes(raes_persona_id);
create index idx_comparticiones_usuario on public.comparticiones(usuario_id, created_at desc);
create index idx_comparticiones_raes_credencial on public.comparticiones(raes_credencial_id);
create index idx_accesos_comparticion on public.accesos_compartidos(comparticion_id, accessed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_perfiles_updated_at before update on public.perfiles
for each row execute function public.set_updated_at();
create trigger trg_vinculaciones_updated_at before update on public.vinculaciones_raes
for each row execute function public.set_updated_at();
create trigger trg_comparticiones_updated_at before update on public.comparticiones
for each row execute function public.set_updated_at();

alter table public.perfiles enable row level security;
alter table public.verificaciones_identidad enable row level security;
alter table public.vinculaciones_raes enable row level security;
alter table public.comparticiones enable row level security;
alter table public.accesos_compartidos enable row level security;

create policy "perfil_select_propio"
on public.perfiles
for select to authenticated
using (id = auth.uid());

create policy "perfil_insert_propio"
on public.perfiles
for insert to authenticated
with check (id = auth.uid());

create policy "perfil_update_propio"
on public.perfiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "verificaciones_select_propias"
on public.verificaciones_identidad
for select to authenticated
using (usuario_id = auth.uid());

create policy "vinculacion_select_propia"
on public.vinculaciones_raes
for select to authenticated
using (usuario_id = auth.uid());

create policy "comparticiones_select_propias"
on public.comparticiones
for select to authenticated
using (usuario_id = auth.uid());
;
