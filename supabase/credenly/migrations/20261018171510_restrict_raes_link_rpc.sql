-- Revoking PUBLIC alone leaves direct default grants to API roles intact.
begin;
revoke all on function public.confirmar_vinculacion_raes(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirmar_vinculacion_raes(uuid, uuid, uuid)
  to service_role;
alter function public.confirmar_vinculacion_raes(uuid, uuid, uuid)
  set search_path = '';
commit;
