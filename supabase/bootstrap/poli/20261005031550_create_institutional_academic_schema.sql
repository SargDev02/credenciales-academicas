
create extension if not exists pgcrypto;

create table public.institucion (
  id uuid primary key default gen_random_uuid(),
  nit varchar(20) not null unique,
  codigo_snies varchar(20),
  nombre varchar(200) not null,
  tipo_institucion varchar(80),
  departamento varchar(100),
  municipio varchar(100),
  direccion varchar(200),
  telefono varchar(50),
  correo varchar(150),
  sitio_web varchar(200),
  estado varchar(20) not null default 'ACTIVA'
    check (estado in ('ACTIVA','INACTIVA','SUSPENDIDA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.institucion(id) on delete restrict,
  codigo varchar(30) not null,
  nombre varchar(150) not null,
  departamento varchar(100) not null,
  municipio varchar(100) not null,
  direccion varchar(200),
  telefono varchar(50),
  correo varchar(150),
  tipo_sede varchar(50),
  estado varchar(20) not null default 'ACTIVA'
    check (estado in ('ACTIVA','INACTIVA','SUSPENDIDA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, codigo)
);

create table public.programas (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.institucion(id) on delete restrict,
  codigo_snies varchar(20),
  codigo_interno varchar(30) not null,
  nombre varchar(200) not null,
  nivel_formacion varchar(80) not null,
  modalidad varchar(50) not null,
  facultad varchar(150),
  estado varchar(20) not null default 'ACTIVO'
    check (estado in ('ACTIVO','INACTIVO','SUSPENDIDO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, codigo_interno)
);

create table public.programa_sede (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas(id) on delete restrict,
  sede_id uuid not null references public.sedes(id) on delete restrict,
  jornada varchar(30),
  modalidad varchar(50),
  estado varchar(20) not null default 'ACTIVO'
    check (estado in ('ACTIVO','INACTIVO','SUSPENDIDO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (programa_id, sede_id)
);

create table public.estudiantes (
  id uuid primary key default gen_random_uuid(),
  tipo_documento varchar(20) not null,
  numero_documento varchar(40) not null,
  primer_nombre varchar(80) not null,
  segundo_nombre varchar(80),
  primer_apellido varchar(80) not null,
  segundo_apellido varchar(80),
  correo_institucional varchar(150),
  correo_personal varchar(150),
  fecha_nacimiento date,
  estado varchar(20) not null default 'ACTIVO'
    check (estado in ('ACTIVO','INACTIVO','GRADUADO','RETIRADO','SUSPENDIDO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_documento, numero_documento)
);

create table public.matriculas (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete restrict,
  programa_sede_id uuid not null references public.programa_sede(id) on delete restrict,
  codigo_estudiante varchar(40) not null,
  periodo_ingreso varchar(20),
  fecha_ingreso date not null,
  fecha_finalizacion date,
  estado_academico varchar(20) not null
    check (estado_academico in ('ACTIVO','GRADUADO','RETIRADO','SUSPENDIDO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo_estudiante, programa_sede_id)
);

create table public.credenciales (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete restrict,
  matricula_id uuid references public.matriculas(id) on delete restrict,
  codigo varchar(50) not null unique,
  tipo varchar(40) not null
    check (tipo in ('DIPLOMA','ACTA_GRADO','CERTIFICADO_ESTUDIOS','CONSTANCIA','CERTIFICADO_CURSO')),
  titulo varchar(250) not null,
  descripcion text,
  fecha_emision date not null,
  fecha_grado date,
  estado varchar(20) not null default 'VIGENTE'
    check (estado in ('VIGENTE','REVOCADO','ANULADO')),
  numero_acta varchar(50),
  numero_folio varchar(50),
  numero_libro varchar(50),
  archivo_url text,
  hash_documento varchar(128),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sedes_institucion on public.sedes(institucion_id);
create index idx_programas_institucion on public.programas(institucion_id);
create index idx_programa_sede_programa on public.programa_sede(programa_id);
create index idx_programa_sede_sede on public.programa_sede(sede_id);
create index idx_matriculas_estudiante on public.matriculas(estudiante_id);
create index idx_matriculas_programa_sede on public.matriculas(programa_sede_id);
create index idx_credenciales_estudiante on public.credenciales(estudiante_id);
create index idx_credenciales_matricula on public.credenciales(matricula_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_institucion
before update on public.institucion
for each row execute function public.set_updated_at();

create trigger set_updated_at_sedes
before update on public.sedes
for each row execute function public.set_updated_at();

create trigger set_updated_at_programas
before update on public.programas
for each row execute function public.set_updated_at();

create trigger set_updated_at_programa_sede
before update on public.programa_sede
for each row execute function public.set_updated_at();

create trigger set_updated_at_estudiantes
before update on public.estudiantes
for each row execute function public.set_updated_at();

create trigger set_updated_at_matriculas
before update on public.matriculas
for each row execute function public.set_updated_at();

create trigger set_updated_at_credenciales
before update on public.credenciales
for each row execute function public.set_updated_at();
;
