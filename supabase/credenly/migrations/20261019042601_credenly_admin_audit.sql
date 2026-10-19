-- Minimal operational audit. No raw payload, email, OCR, credentials or tokens.
create table public.auditoria_admin (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.perfiles_admin(id) on delete restrict,
  accion varchar(40) not null check (accion in ('ADMIN_PROFILE_READ', 'OPERATIONS_READ', 'AUTH_ACCOUNTS_READ', 'HEALTH_READ')),
  resultado varchar(10) not null check (resultado in ('EXITO', 'ERROR')),
  recurso_tipo varchar(40) not null check (recurso_tipo in ('ADMIN_PROFILE', 'OPERATIONS', 'AUTH_ACCOUNTS', 'HEALTH')),
  recurso_id uuid,
  created_at timestamptz not null default now()
);
alter table public.auditoria_admin enable row level security;
revoke all on public.auditoria_admin from public, anon, authenticated, service_role;
-- Runtime is append/read only. Retention/purge/export require a separate decision.
grant select, insert on public.auditoria_admin to service_role;
create index auditoria_admin_actor_created_idx on public.auditoria_admin(actor_id, created_at desc);
create index auditoria_admin_errors_created_idx on public.auditoria_admin(created_at desc) where resultado = 'ERROR';
comment on table public.auditoria_admin is 'Minimal Credenly administrative read audit; no retention jobs or raw sensitive payloads.';
