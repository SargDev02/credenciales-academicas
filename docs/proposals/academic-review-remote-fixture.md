# Prueba remota pendiente de excepción a la restricción institucional

La instrucción de reconexión del 2026-11-09 exige no modificar las bases Poli/UdeA.
Por eso no se ejecuta el escenario remoto del requerimiento anterior que creaba
un nuevo registro institucional. La prueba equivalente aislada sí usa PostgreSQL,
las APIs Next construidas y navegador, sin red remota ni cuentas reales.

Propuesta mínima, **autorizada expresamente por el propietario; ejecución controlada pendiente**:

- Solo Poli, reutilizando programa/sede/oferta activos existentes, sin modificarlos.
- Crear exactamente tres filas nuevas: estudiante, matrícula y credencial.
- Documento `CC / SYNTH-RVW-20261109-001`;
  código estudiante y credencial `SYNTH-POLI-REVIEW-20261109-001`.
- Nombre sintético «Sintética Revisión», título «Credencial sintética revisión A»;
  fecha emisión 2026-11-09. Sin correo real ni documentos personales.
- Comprobar colisiones antes; cualquier coincidencia aborta, sin upsert/adopción.
- Registrar UUID de las tres filas al crear; no actualizar ninguna fila previa.
- Detector normal → una incorporación agrupada pendiente → aprobación explícita
  mediante API admin con contraseña introducida oculta (no se restablece).
- Crear una cuenta ciudadana temporal `review-20261109@fixture.invalid` mediante
  Auth oficial, contraseña aleatoria solo en memoria. Perfil, verificación
  documental sintética y vínculo normales; no crear snapshots académicos.
- Verificar credencial A por HTTP Credenly. Cambiar exclusivamente el título de
  la nueva credencial sintética a B, detectar; comprobar que Credenly sigue en A
  mientras PENDIENTE; aprobar explícitamente y siguiente GET devuelve B.
- Repetir detección y aprobación para comprobar ausencia de versiones/eventos
  duplicados. No modificar Valentina, admins, fixture C/D ni cuentas existentes.
- Cerrar sesiones y eliminar la cuenta temporal y solo sus relaciones ciudadanas;
  comprobar cero residuos. Si hay FK o limpieza ambigua, detener sin forzar.
- Conservar las tres filas sintéticas institucionales y su historial canónico
  RAES permanentemente documentados: no borrar/recrear historial inmutable.
- UdeA y todos los registros previos permanecerían sin cambios.

La autorización para crear la migración de revisión/baseline no implica aprobar
esta excepción sobre la fuente institucional. Ninguna prueba local se presentará
como esta prueba remota.

La identificación final usa RVW para mantenerse dentro del máximo de 24
caracteres del parser OCR existente, sin excepciones en producto. Manifest y SQL
preparados en `supabase/fixtures/academic-review/`. El programa/sede/oferta se
compararon con RAES antes de la prueba y coinciden; no requieren actualización.
El documento sintético se renderiza en memoria y se envía al OCR local real; no
se inserta una verificación aprobada directamente. No se usa un documento real.
