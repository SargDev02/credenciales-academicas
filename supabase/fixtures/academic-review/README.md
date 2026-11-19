# Fixture permanente de revisión académica

Desarrollo/prueba, autorizado expresamente por el propietario el2026-11-09.
Solo Poli recibió tres filas nuevas; UdeA y todos los registros previos se conservaron.
No reejecutar `poli.sql`: aborta ante cualquier colisión y no hace upsert.

| Dato | Valor |
| --- | --- |
| Documento sintético | CC / SYNTH-RVW-20261109-001 |
| Estudiante Poli | fef04b81-da0a-42b3-8298-14ef89b2dd25 |
| Matrícula Poli | b41a55b6-db8d-4b1f-acc5-0e77a92a12d9 |
| Credencial fuente Poli | 094615f8-10d9-495f-8233-dcacb0fb8c55 |
| Código estudiante/credencial | SYNTH-POLI-REVIEW-20261109-001 |
| Oferta existente reutilizada | Programa SIM-POLI-INF, sede RIO; sin modificarlos |
| Persona maestra RAES | 77cf8d08-fd62-42ac-94bf-404a653b7fec |
| Credencial RAES | 3611d73f-e7bc-47a9-96cc-45e77ac47dc7 / RAES-CRD-00000033 |
| Revisión de incorporación | 19cccf59-e73e-45b2-ac3b-915fbf9bd8ed / APROBADA |
| Revisión de título A→B | 7cdec780-ff39-4ca9-99cf-a8e742eff025 / APROBADA |
| Estado final | VIGENTE, versión2, Credencial sintetica revision B |

Fecha de ingreso/emisión2026-11-09. Nombres Sintetica Revision, sin personas reales.
El operador cambió únicamente el título de su nueva credencial fuente de A a B;
updated_at se actualizó por el mecanismo institucional existente. Sin DDL ni
programas/sedes/ofertas nuevas. Ningún dato académico se insertó directamente en
RAES: detección institucional→propuesta→aprobación administrativa en ambos pasos.
Credenly recuperó A, conservó A mientras B estaba pendiente y obtuvo B al aprobar.

Dos cuentas ciudadanas temporales se usaron en intentos separados; ambas eliminadas
con sus relaciones, identidades y sesiones confirmadas en cero. El primer intento
reveló un bug del parser OCR y se detuvo antes de vincular; el fix genérico fue
autorizado y la reanudación usó OCR local real (0.93), sin verificación insertada
manualmente ni excepciones. Ningún correo real, contraseña/token persistido,
cuenta existente modificada o historial académico borrado.

El segundo operador se detuvo en su bloque final de observación de idempotencia,
después de validar la lectura HTTP A→B y cerrar/limpiar las sesiones. Su artefacto
FAIL se conserva. El postcheck complementario terminó PASS: detección0propuestas,
RPC replay con service_role/ROLLBACK, mismas huellas de once tablas canónicas y
cero residuos de las cuentas. El replay remoto no se presenta como HTTP; el replay
HTTP se cubre en integración local. La causa exacta del último fallo del operador
no se reprodujo y su diagnóstico quedó ampliado por etapas.

Para volver a comprobar el fixture final, desde la raíz y con los servidores locales:

```bash
pnpm --filter @raes/api exec node scripts/verify-academic-review-postcheck.mjs
```

No requiere contraseñas ciudadanas ni crea cuentas o nuevas decisiones. Usa la
configuración local server-only y el perfil CLI propietario para consultas SQL.
No ejecutar modos inicial/resume sobre el fixture ya en B: los prechecks los
bloquean deliberadamente. Conservar fuente, persona, fuente RAES, versiones,
eventos y decisiones como dataset sintético permanente.

Evidencia en `docs/reports/evidence/academic-review-live-*.json`; manifest sin secretos.
