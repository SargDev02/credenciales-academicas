# Motor de conectores institucionales

Código TypeScript compartido por los conectores Politécnico y Universidad de
Antioquia. Lee exclusivamente la fuente institucional y escribe exclusivamente
por la API RAES. No contiene credenciales ni estado persistente propio.

- Lectura paginada y ordenada por ID, sin límite silencioso de 1000 filas.
- Contratos Zod y verificación de referencias antes de la primera escritura.
- Namespaces separados (`poli`, `udea`), conservando las claves históricas Poli.
- Consulta del estado vigente mediante `credentials:read`, acotada a la institución.
- Solo administra registros cuya operación original coincide con su clave de alta.
- Compara contenido vigente para corregir incluso una vuelta al valor inicial.
- Repeticiones sin cambios no generan versiones ni eventos adicionales.
- Estados terminales iguales no se reenvían; contradicciones se reportan y la CLI
  termina con código 1. No se reactiva ni sobrescribe una credencial terminal.

Las pruebas de transporte y del motor son locales. No sustituyen la validación
contra las fuentes y la API reales, documentada en `docs/progress.md`.
