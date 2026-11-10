-- Verified against RAES: actor_id is a polymorphic UUID without an auth.users FK.
-- Preserve existing actors, rows, RLS and grants. No new academic storage.
begin;

alter table public.auditoria
  drop constraint auditoria_actor_tipo_check;
alter table public.auditoria
  add constraint auditoria_actor_tipo_check
  check (actor_tipo in ('ADMIN', 'INTEGRACION', 'SISTEMA', 'CLIENTE_API'));

commit;
;
