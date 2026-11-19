
drop policy if exists "perfil_select_propio" on public.perfiles;
drop policy if exists "perfil_insert_propio" on public.perfiles;
drop policy if exists "perfil_update_propio" on public.perfiles;
drop policy if exists "verificaciones_select_propias" on public.verificaciones_identidad;
drop policy if exists "vinculacion_select_propia" on public.vinculaciones_raes;
drop policy if exists "comparticiones_select_propias" on public.comparticiones;

create policy "perfil_select_propio"
on public.perfiles
for select to authenticated
using (id = (select auth.uid()));

create policy "perfil_insert_propio"
on public.perfiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy "perfil_update_propio"
on public.perfiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "verificaciones_select_propias"
on public.verificaciones_identidad
for select to authenticated
using (usuario_id = (select auth.uid()));

create policy "vinculacion_select_propia"
on public.vinculaciones_raes
for select to authenticated
using (usuario_id = (select auth.uid()));

create policy "comparticiones_select_propias"
on public.comparticiones
for select to authenticated
using (usuario_id = (select auth.uid()));
;
