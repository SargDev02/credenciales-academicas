-- Development fixture approved for PR #14. Run once, only on POLI.
-- No UPDATE/DELETE/upsert; any collision aborts the entire transaction.
begin;
do $$
begin
  if (select count(*) from public.institucion) <> 1
     or not exists (select 1 from public.institucion where nit = '890980136-6') then
    raise exception 'WRONG_FIXTURE_INSTITUTION';
  end if;
  if not exists (
    select 1 from public.programa_sede ps
    join public.programas p on p.id = ps.programa_id
    join public.sedes s on s.id = ps.sede_id
    where ps.id = '317936ce-a820-4eda-b433-64c57439e1a3' and ps.estado = 'ACTIVO'
      and p.codigo_interno = 'SIM-POLI-INF' and s.codigo = 'RIO'
  ) then raise exception 'FIXTURE_PROGRAM_CAMPUS_MISSING'; end if;
  if exists (select 1 from public.estudiantes where numero_documento = 'SYNTH-CD-20261018-001' or id = 'a0182026-1018-4000-8000-000000000001')
     or exists (select 1 from public.matriculas where id = 'a0182026-1018-4000-8000-000000000002' or codigo_estudiante = 'SYNTH-POLI-CD-20261018-001')
     or exists (select 1 from public.credenciales where id = 'a0182026-1018-4000-8000-000000000003' or codigo = 'SYNTH-POLI-CD-20261018-001') then
    raise exception 'FIXTURE_COLLISION_REVIEW_EXISTING_ROWS';
  end if;
  insert into public.estudiantes
    (id, tipo_documento, numero_documento, primer_nombre, primer_apellido, estado)
  values ('a0182026-1018-4000-8000-000000000001', 'CC', 'SYNTH-CD-20261018-001', 'Sintetica', 'Multiinstitucion', 'ACTIVO');
  insert into public.matriculas
    (id, estudiante_id, programa_sede_id, codigo_estudiante, periodo_ingreso, fecha_ingreso, estado_academico)
  values ('a0182026-1018-4000-8000-000000000002', 'a0182026-1018-4000-8000-000000000001', '317936ce-a820-4eda-b433-64c57439e1a3', 'SYNTH-POLI-CD-20261018-001', '2026-2', '2026-08-01', 'ACTIVO');
  insert into public.credenciales
    (id, estudiante_id, matricula_id, codigo, tipo, titulo, descripcion, fecha_emision, estado)
  values ('a0182026-1018-4000-8000-000000000003', 'a0182026-1018-4000-8000-000000000001', 'a0182026-1018-4000-8000-000000000002', 'SYNTH-POLI-CD-20261018-001',
    'CERTIFICADO_ESTUDIOS', 'Certificado sintetico multiinstitucion POLI',
    'Fixture de desarrollo PR 14, casos C/D. Sin datos personales reales.', '2026-10-18', 'VIGENTE');
end $$;
commit;
select 'FIXTURE_POLI_INSERTED' as result;
