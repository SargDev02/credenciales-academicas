-- Authorized development fixture, three new rows only; never upsert existing data.
begin;
do $$
declare offer uuid;
begin
 if (select count(*) from public.institucion)<>1 or not exists(select 1 from public.institucion where nit='890980136-6') then raise exception 'WRONG_FIXTURE_INSTITUTION'; end if;
 select ps.id into strict offer from public.programa_sede ps join public.programas p on p.id=ps.programa_id join public.sedes s on s.id=ps.sede_id where p.codigo_interno='SIM-POLI-INF' and s.codigo='RIO' and p.estado='ACTIVO' and s.estado='ACTIVA' and ps.estado='ACTIVO';
 if exists(select 1 from public.estudiantes where numero_documento='SYNTH-RVW-20261109-001' or id='fef04b81-da0a-42b3-8298-14ef89b2dd25') or exists(select 1 from public.matriculas where codigo_estudiante='SYNTH-POLI-REVIEW-20261109-001' or id='b41a55b6-db8d-4b1f-acc5-0e77a92a12d9') or exists(select 1 from public.credenciales where codigo='SYNTH-POLI-REVIEW-20261109-001' or id='094615f8-10d9-495f-8233-dcacb0fb8c55') then raise exception 'FIXTURE_COLLISION'; end if;
 insert into public.estudiantes(id,tipo_documento,numero_documento,primer_nombre,primer_apellido,estado) values('fef04b81-da0a-42b3-8298-14ef89b2dd25','CC','SYNTH-RVW-20261109-001','Sintetica','Revision','ACTIVO');
 insert into public.matriculas(id,estudiante_id,programa_sede_id,codigo_estudiante,periodo_ingreso,fecha_ingreso,estado_academico) values('b41a55b6-db8d-4b1f-acc5-0e77a92a12d9','fef04b81-da0a-42b3-8298-14ef89b2dd25',offer,'SYNTH-POLI-REVIEW-20261109-001','2026-2','2026-11-09','ACTIVO');
 insert into public.credenciales(id,estudiante_id,matricula_id,codigo,tipo,titulo,descripcion,fecha_emision,estado) values('094615f8-10d9-495f-8233-dcacb0fb8c55','fef04b81-da0a-42b3-8298-14ef89b2dd25','b41a55b6-db8d-4b1f-acc5-0e77a92a12d9','SYNTH-POLI-REVIEW-20261109-001','CERTIFICADO_ESTUDIOS','Credencial sintetica revision A','Fixture permanente de revision supervisada. Sin datos reales.','2026-11-09','VIGENTE');
end $$;
commit;
