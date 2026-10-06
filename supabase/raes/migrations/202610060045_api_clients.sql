create table public.clientes_api (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(160) not null,
  tipo_cliente varchar(40) not null,
  client_id varchar(120) not null unique,
  estado varchar(20) not null default 'ACTIVO',
  ultimo_uso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_api_tipo_cliente_check
    check (tipo_cliente in ('CREDENLY', 'VERIFICADOR', 'GOBERNACION', 'OTRO')),
  constraint clientes_api_estado_check
    check (estado in ('ACTIVO', 'SUSPENDIDO', 'REVOCADO'))
);

create table public.cliente_api_secretos (
  id uuid primary key default gen_random_uuid(),
  cliente_api_id uuid not null references public.clientes_api(id) on delete cascade,
  key_prefix varchar(32) not null unique,
  secret_hash varchar(128) not null,
  hash_algorithm varchar(20) not null default 'SHA256',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cliente_api_secretos_hash_algorithm_check
    check (hash_algorithm in ('SHA256', 'ARGON2ID'))
);

create table public.cliente_api_scopes (
  cliente_api_id uuid not null references public.clientes_api(id) on delete cascade,
  scope_id uuid not null references public.scopes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_api_id, scope_id)
);

create index idx_cliente_api_secretos_cliente
  on public.cliente_api_secretos(cliente_api_id);

create index idx_cliente_api_scopes_scope
  on public.cliente_api_scopes(scope_id);

alter table public.clientes_api enable row level security;
alter table public.cliente_api_secretos enable row level security;
alter table public.cliente_api_scopes enable row level security;

create trigger trg_clientes_api_updated_at
before update on public.clientes_api
for each row execute function public.set_updated_at();

insert into public.scopes (codigo, descripcion)
values
  ('persons:resolve', 'Resolver una persona maestra por identidad verificada')
on conflict (codigo) do update
set descripcion = excluded.descripcion;
