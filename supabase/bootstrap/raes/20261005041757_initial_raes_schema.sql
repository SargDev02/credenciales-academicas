
create extension if not exists pgcrypto;

create sequence if not exists public.credencial_codigo_seq start 1;

create table public.instituciones (
  id uuid primary key default gen_random_uuid(),
  nit varchar(20) not null unique,
  codigo_snies varchar(30) unique,
  nombre varchar(200) not null,
  tipo_institucion varchar(100) not null,
  estado varchar(20) not null default 'ACTIVA'
    check (estado in ('ACTIVA','INACTIVA','SUSPENDIDA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones(id) on delete restrict,
  codigo_origen varchar(50) not null,
  nombre varchar(180) not null,
  departamento varchar(100),
  municipio varchar(100),
  direccion varchar(220),
  estado varchar(20) not null default 'ACTIVA'
    check (estado in ('ACTIVA','INACTIVA','SUSPENDIDA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, codigo_origen)
);

create table public.programas (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones(id) on delete restrict,
  codigo_origen varchar(60) not null,
  codigo_snies varchar(30),
  nombre varchar(220) not null,
  nivel_formacion varchar(100),
  modalidad varchar(60),
  facultad varchar(180),
  estado varchar(20) not null default 'ACTIVO'
    check (estado in ('ACTIVO','INACTIVO','SUSPENDIDO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, codigo_origen)
);

create table public.programa_sede (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas(id) on delete restrict,
  sede_id uuid not null references public.sedes(id) on delete restrict,
  jornada varchar(50),
  modalidad varchar(60),
  estado varchar(20) not null default 'ACTIVO'
    check (estado in ('ACTIVO','INACTIVO','SUSPENDIDO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (programa_id, sede_id)
);

create table public.personas_maestra (
  id uuid primary key default gen_random_uuid(),
  tipo_documento varchar(20) not null,
  numero_documento varchar(50) not null,
  primer_nombre varchar(100) not null,
  segundo_nombre varchar(100),
  primer_apellido varchar(100) not null,
  segundo_apellido varchar(100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_documento, numero_documento)
);

create table public.persona_fuentes (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas_maestra(id) on delete restrict,
  institucion_id uuid not null references public.instituciones(id) on delete restrict,
  identificador_origen varchar(120) not null,
  tipo_documento_reportado varchar(20) not null,
  numero_documento_reportado varchar(50) not null,
  primer_nombre_reportado varchar(100) not null,
  segundo_nombre_reportado varchar(100),
  primer_apellido_reportado varchar(100) not null,
  segundo_apellido_reportado varchar(100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (institucion_id, identificador_origen)
);

create table public.integraciones_institucionales (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones(id) on delete restrict,
  nombre varchar(160) not null,
  client_id varchar(80) not null unique,
  estado varchar(20) not null default 'ACTIVA'
    check (estado in ('ACTIVA','SUSPENDIDA','REVOCADA')),
  ultimo_uso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, nombre)
);

create table public.integracion_secretos (
  id uuid primary key default gen_random_uuid(),
  integracion_id uuid not null references public.integraciones_institucionales(id) on delete restrict,
  key_prefix varchar(24) not null unique,
  secret_hash varchar(255) not null,
  hash_algorithm varchar(20) not null default 'SHA256'
    check (hash_algorithm in ('SHA256','ARGON2ID')),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.scopes (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(80) not null unique,
  descripcion varchar(250) not null,
  created_at timestamptz not null default now()
);

create table public.integracion_scopes (
  integracion_id uuid not null references public.integraciones_institucionales(id) on delete cascade,
  scope_id uuid not null references public.scopes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (integracion_id, scope_id)
);

create table public.credenciales (
  id uuid primary key default gen_random_uuid(),
  codigo_raes varchar(32) not null unique
    default ('RAES-CRD-' || lpad(nextval('public.credencial_codigo_seq')::text, 8, '0')),
  institucion_id uuid not null references public.instituciones(id) on delete restrict,
  persona_id uuid not null references public.personas_maestra(id) on delete restrict,
  programa_id uuid references public.programas(id) on delete restrict,
  sede_id uuid references public.sedes(id) on delete restrict,
  codigo_origen varchar(100) not null,
  tipo varchar(80) not null,
  categoria varchar(30) not null default 'OTRO'
    check (categoria in ('TITULO','CURSO','DIPLOMADO','CERTIFICACION','RECONOCIMIENTO','OTRO')),
  estado_actual varchar(20) not null default 'VIGENTE'
    check (estado_actual in ('VIGENTE','REVOCADA','ANULADA')),
  version_actual integer not null default 1 check (version_actual >= 1),
  fecha_registro_raes timestamptz not null default now(),
  revocada_at timestamptz,
  motivo_revocacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, codigo_origen)
);

alter sequence public.credencial_codigo_seq owned by public.credenciales.codigo_raes;

create table public.credencial_versiones (
  id uuid primary key default gen_random_uuid(),
  credencial_id uuid not null references public.credenciales(id) on delete restrict,
  numero_version integer not null check (numero_version >= 1),
  programa_id uuid references public.programas(id) on delete restrict,
  sede_id uuid references public.sedes(id) on delete restrict,
  titulo varchar(300) not null,
  descripcion text,
  fecha_emision date not null,
  fecha_grado date,
  estado_reportado varchar(20) not null
    check (estado_reportado in ('VIGENTE','REVOCADA','ANULADA')),
  numero_acta varchar(80),
  numero_folio varchar(80),
  numero_libro varchar(80),
  documento_path text,
  documento_hash_sha256 varchar(64)
    check (documento_hash_sha256 is null or length(documento_hash_sha256) = 64),
  payload_original jsonb not null,
  payload_hash_sha256 varchar(64) not null
    check (length(payload_hash_sha256) = 64),
  registrada_por_integracion_id uuid not null
    references public.integraciones_institucionales(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (credencial_id, numero_version)
);

create table public.credencial_eventos (
  id uuid primary key default gen_random_uuid(),
  credencial_id uuid not null references public.credenciales(id) on delete restrict,
  version_id uuid references public.credencial_versiones(id) on delete restrict,
  tipo_evento varchar(30) not null
    check (tipo_evento in ('REGISTRADA','CORREGIDA','REVOCADA','ANULADA')),
  motivo text,
  metadata jsonb not null default '{}'::jsonb,
  integracion_id uuid not null
    references public.integraciones_institucionales(id) on delete restrict,
  ocurrido_at timestamptz not null,
  registrado_at timestamptz not null default now()
);

create table public.operaciones_api (
  id uuid primary key default gen_random_uuid(),
  integracion_id uuid not null references public.integraciones_institucionales(id) on delete restrict,
  request_id varchar(120) not null,
  idempotency_key varchar(160) not null,
  tipo_operacion varchar(80) not null,
  request_hash varchar(64) not null check (length(request_hash) = 64),
  estado varchar(20) not null default 'RECIBIDA'
    check (estado in ('RECIBIDA','PROCESANDO','COMPLETADA','ERROR')),
  credencial_id uuid references public.credenciales(id) on delete restrict,
  codigo_http smallint,
  error_code varchar(80),
  error_detalle text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (integracion_id, idempotency_key),
  unique (integracion_id, request_id)
);

create table public.perfiles_admin (
  id uuid primary key references auth.users(id) on delete cascade,
  nombres varchar(160) not null,
  apellidos varchar(160) not null,
  rol varchar(20) not null
    check (rol in ('SUPERADMIN','ADMIN','AUDITOR')),
  estado varchar(20) not null default 'ACTIVO'
    check (estado in ('ACTIVO','SUSPENDIDO','INACTIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_tipo varchar(20) not null
    check (actor_tipo in ('ADMIN','INTEGRACION','SISTEMA')),
  actor_id uuid,
  accion varchar(120) not null,
  recurso_tipo varchar(80) not null,
  recurso_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_sedes_institucion on public.sedes(institucion_id);
create index idx_programas_institucion on public.programas(institucion_id);
create index idx_programa_sede_programa on public.programa_sede(programa_id);
create index idx_programa_sede_sede on public.programa_sede(sede_id);
create index idx_personas_documento on public.personas_maestra(tipo_documento, numero_documento);
create index idx_persona_fuentes_persona on public.persona_fuentes(persona_id);
create index idx_persona_fuentes_institucion on public.persona_fuentes(institucion_id);
create index idx_integraciones_institucion on public.integraciones_institucionales(institucion_id);
create index idx_credenciales_persona on public.credenciales(persona_id);
create index idx_credenciales_institucion on public.credenciales(institucion_id);
create index idx_credenciales_estado on public.credenciales(estado_actual);
create index idx_credenciales_programa on public.credenciales(programa_id);
create index idx_credenciales_sede on public.credenciales(sede_id);
create index idx_versiones_credencial on public.credencial_versiones(credencial_id, numero_version desc);
create index idx_eventos_credencial on public.credencial_eventos(credencial_id, registrado_at desc);
create index idx_operaciones_integracion on public.operaciones_api(integracion_id, received_at desc);
create index idx_auditoria_created_at on public.auditoria(created_at desc);

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

create trigger trg_instituciones_updated_at before update on public.instituciones
for each row execute function public.set_updated_at();
create trigger trg_sedes_updated_at before update on public.sedes
for each row execute function public.set_updated_at();
create trigger trg_programas_updated_at before update on public.programas
for each row execute function public.set_updated_at();
create trigger trg_programa_sede_updated_at before update on public.programa_sede
for each row execute function public.set_updated_at();
create trigger trg_personas_updated_at before update on public.personas_maestra
for each row execute function public.set_updated_at();
create trigger trg_integraciones_updated_at before update on public.integraciones_institucionales
for each row execute function public.set_updated_at();
create trigger trg_credenciales_updated_at before update on public.credenciales
for each row execute function public.set_updated_at();
create trigger trg_perfiles_admin_updated_at before update on public.perfiles_admin
for each row execute function public.set_updated_at();

create or replace function public.prevent_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'DELETE no permitido sobre registros trazables de RAES';
end;
$$;

create or replace function public.prevent_update_or_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Registro histórico inmutable en RAES';
end;
$$;

create trigger trg_no_delete_instituciones before delete on public.instituciones
for each row execute function public.prevent_delete();
create trigger trg_no_delete_sedes before delete on public.sedes
for each row execute function public.prevent_delete();
create trigger trg_no_delete_programas before delete on public.programas
for each row execute function public.prevent_delete();
create trigger trg_no_delete_programa_sede before delete on public.programa_sede
for each row execute function public.prevent_delete();
create trigger trg_no_delete_personas before delete on public.personas_maestra
for each row execute function public.prevent_delete();
create trigger trg_no_delete_persona_fuentes before delete on public.persona_fuentes
for each row execute function public.prevent_delete();
create trigger trg_no_delete_credenciales before delete on public.credenciales
for each row execute function public.prevent_delete();
create trigger trg_versiones_inmutables before update or delete on public.credencial_versiones
for each row execute function public.prevent_update_or_delete();
create trigger trg_eventos_inmutables before update or delete on public.credencial_eventos
for each row execute function public.prevent_update_or_delete();

alter table public.instituciones enable row level security;
alter table public.sedes enable row level security;
alter table public.programas enable row level security;
alter table public.programa_sede enable row level security;
alter table public.personas_maestra enable row level security;
alter table public.persona_fuentes enable row level security;
alter table public.integraciones_institucionales enable row level security;
alter table public.integracion_secretos enable row level security;
alter table public.scopes enable row level security;
alter table public.integracion_scopes enable row level security;
alter table public.credenciales enable row level security;
alter table public.credencial_versiones enable row level security;
alter table public.credencial_eventos enable row level security;
alter table public.operaciones_api enable row level security;
alter table public.perfiles_admin enable row level security;
alter table public.auditoria enable row level security;

create policy "admin_read_own_profile"
on public.perfiles_admin
for select
to authenticated
using (id = auth.uid());
;
