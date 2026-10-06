create or replace function public.confirmar_vinculacion_raes(
  p_usuario_id uuid,
  p_verificacion_identidad_id uuid,
  p_raes_persona_id uuid
)
returns public.vinculaciones_raes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.vinculaciones_raes;
begin
  if not exists (
    select 1
    from public.verificaciones_identidad v
    where v.id = p_verificacion_identidad_id
      and v.usuario_id = p_usuario_id
      and v.estado = 'APROBADA'
  ) then
    raise exception 'CREDENLY_VERIFICATION_NOT_APPROVED';
  end if;

  if exists (
    select 1
    from public.vinculaciones_raes vr
    where vr.raes_persona_id = p_raes_persona_id
      and vr.usuario_id <> p_usuario_id
      and vr.estado = 'VERIFICADA'
  ) then
    raise exception 'CREDENLY_RAES_PERSON_ALREADY_LINKED';
  end if;

  insert into public.vinculaciones_raes (
    usuario_id,
    raes_persona_id,
    verificacion_identidad_id,
    estado,
    metodo_verificacion,
    verified_at
  )
  values (
    p_usuario_id,
    p_raes_persona_id,
    p_verificacion_identidad_id,
    'VERIFICADA',
    'OCR_DOCUMENTO',
    now()
  )
  on conflict (usuario_id)
  do update set
    raes_persona_id = excluded.raes_persona_id,
    verificacion_identidad_id = excluded.verificacion_identidad_id,
    estado = 'VERIFICADA',
    metodo_verificacion = 'OCR_DOCUMENTO',
    verified_at = now(),
    updated_at = now()
  returning * into v_link;

  update public.perfiles
  set
    estado = 'ACTIVO',
    updated_at = now()
  where id = p_usuario_id;

  return v_link;
end;
$$;

revoke all on function public.confirmar_vinculacion_raes(uuid, uuid, uuid)
from public;

grant execute on function public.confirmar_vinculacion_raes(uuid, uuid, uuid)
to service_role;
