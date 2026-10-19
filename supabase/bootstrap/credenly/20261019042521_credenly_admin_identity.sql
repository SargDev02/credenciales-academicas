-- Dedicated administrative identity. No Auth users or citizen profiles are changed.
create table public.perfiles_admin (
  id uuid primary key references auth.users(id) on delete restrict,
  nombres varchar(160) not null check (length(btrim(nombres)) between 1 and 160),
  apellidos varchar(160) not null check (length(btrim(apellidos)) between 1 and 160),
  rol varchar(40) not null default 'ADMIN_CREDENLY' check (rol = 'ADMIN_CREDENLY'),
  estado varchar(20) not null default 'INACTIVO' check (estado in ('ACTIVO', 'INACTIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
;
alter table public.perfiles_admin enable row level security
;
-- No browser policies: only the backend service role manages administrative identity.
revoke all on public.perfiles_admin from public, anon, authenticated, service_role
;
grant select, insert, update on public.perfiles_admin to service_role
;
create trigger trg_perfiles_admin_updated_at before update on public.perfiles_admin
for each row execute function public.set_updated_at()
;
comment on table public.perfiles_admin is 'Credenly-only administrative identity; never assigned by email or editable Auth metadata.'
;
