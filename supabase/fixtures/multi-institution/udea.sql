-- Development fixture approved for PR #14. Run once, only on UDEA.
-- No UPDATE/DELETE/upsert; any collision aborts the entire transaction.
begin;
do $$
begin
  if (select count(*) from public.institucion) <> 1
     or not exists (select 1 from public.institucion where nit = '890980040-8') then
    raise exception 'WRONG_FIXTURE_INSTITUTION';
  end if;
  if not exists (
    select 1 from public.programa_sede ps
    join public.programas p on p.id = ps.programa_id
    join public.sedes s on s.id = ps.sede_id
    where ps.id = '021f89b1-4bb3-44de-913d-18672ed46611' and ps.estado = 'ACTIVO'
      and p.codigo_interno = 'SIM-UDEA-PSI' and s.codigo = 'YAR'
  ) then raise exception 'FIXTURE_PROGRAM_CAMPUS_MISSING'; end if;
  if exists (select 1 from public.estudiantes where numero_documento = 'SYNTH-CD-20261018-001' or id = 'b0182026-1018-4000-8000-000000000001')
     or exists (select 1 from public.matriculas where id = 'b0182026-1018-4000-8000-000000000002' or codigo_estudiante = 'SYNTH-UDEA-CD-20261018-001')
     or exists (select 1 from public.credenciales where id = 'b0182026-1018-4000-8000-000000000003' or codigo = 'SYNTH-UDEA-CD-20261018-001') then
    raise exception 'FIXTURE_COLLISION_REVIEW_EXISTING_ROWS';
  end if;
  insert into public.estudiantes
    (id, tipo_documento, numero_documento, primer_nombre, primer_apellido, estado)
  values ('b0182026-1018-4000-8000-000000000001', 'CC', 'SYNTH-CD-20261018-001', 'Sintetica', 'Multiinstitucion', 'ACTIVO');
  insert into public.matriculas
    (id, estudiante_id, programa_sede_id, codigo_estudiante, periodo_ingreso, fecha_ingreso, estado_academico)
  values ('b0182026-1018-4000-8000-000000000002', 'b0182026-1018-4000-8000-000000000001', '021f89b1-4bb3-44de-913d-18672ed46611', 'SYNTH-UDEA-CD-20261018-001', '2026-2', '2026-08-01', 'ACTIVO');
  insert into public.credenciales
    (id, estudiante_id, matricula_id, codigo, tipo, titulo, descripcion, fecha_emision, estado)
  values ('b0182026-1018-4000-8000-000000000003', 'b0182026-1018-4000-8000-000000000001', 'b0182026-1018-4000-8000-000000000002', 'SYNTH-UDEA-CD-20261018-001',
    'CERTIFICADO_ESTUDIOS', 'Certificado sintetico multiinstitucion UDEA',
    'Fixture de desarrollo PR 14, casos C/D. Sin datos personales reales.', '2026-10-18', 'VIGENTE');
end $$;
commit;
select 'FIXTURE_UDEA_INSERTED' as result;
