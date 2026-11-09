
create index if not exists idx_credencial_eventos_integracion on public.credencial_eventos(integracion_id);
create index if not exists idx_credencial_eventos_version on public.credencial_eventos(version_id);
create index if not exists idx_credencial_versiones_programa on public.credencial_versiones(programa_id);
create index if not exists idx_credencial_versiones_sede on public.credencial_versiones(sede_id);
create index if not exists idx_credencial_versiones_integracion on public.credencial_versiones(registrada_por_integracion_id);
create index if not exists idx_integracion_scopes_scope on public.integracion_scopes(scope_id);
create index if not exists idx_integracion_secretos_integracion on public.integracion_secretos(integracion_id);
create index if not exists idx_operaciones_credencial on public.operaciones_api(credencial_id);

drop policy if exists "admin_read_own_profile" on public.perfiles_admin;
create policy "admin_read_own_profile"
on public.perfiles_admin
for select to authenticated
using (id = (select auth.uid()));
;
