# Estado de reconexión y revisión académica — 2026-11-09

**Implementación y validación local completas; prueba remota de incorporación
pendiente de acceso administrativo.** El propietario reintentó la contraseña de
RAES; Supabase volvió a responder400 invalid_credentials. No se creó fixture,
cuenta temporal ni propuesta académica. El precheck de la cuenta sigue correcto.
El propietario autorizó después restablecer solo ese administrador RAES. El
operador exigió UUID y proyecto esperados. El nuevo restablecimiento ya terminó:
Auth/API/navegador PASS, perfil y rol intactos. La prueba de incorporación requiere
una nueva sesión administrativa; las sesiones de comprobación se cerraron.

| Punto solicitado | Resultado comprobado |
| --- | --- |
| 1. Git | feat/raes-academic-review; base main09e9775, sin mezcla del PR#16 |
| 2. Archivos previos | Los56 paths del informe de reconexión se preservaron; inventario JSON adjunto |
| 3. Archivos modificados ahora | Inventario completo versionable en evidence/academic-review-file-inventory.json; cambios agrupados por contratos/SQL, detectores, APIs, web, pruebas y operación Auth |
| 4. Destinos | RAES askqizcwemmydwcgrewp / Credenly xvzylegwuxmxqcgdjjrq |
| 5. Fuentes | Poli/UdeA intactas hasta este checkpoint; excepción de tres filas Poli aprobada, todavía sin ejecutar |
| 6. Entorno | Solo cuatro env RAES/Credenly ignorados; nombres exactos en informe de reconexión, sin valores secretos. Credenciales institucionales conservadas |
| 7. RAES | health200, health/ready200 database up |
| 8. Credenly | health200, health/ready200 database/auth/raes up |
| 9. Cred→RAES | Cliente real y HTTP ciudadano existentes200; terminales v3/v2 y sintéticas vigentes multiinstitución, cero acceso directo a RAES DB/fuentes |
| 10. Poli→RAES | whoami200; detector13/13,0 solicitudes/0 escrituras canónicas |
| 11. UdeA→RAES | whoami200; detector18/18,0 solicitudes/0 escrituras canónicas |
| 12. Login RAES | Reset inicialmente autorizado y login Auth/API/browser PASS con mismo UUID/SUPERADMIN/ACTIVO. El intento posterior falló por contraseña; un nuevo reset específicamente autorizado ya pasó Auth/API/browser. Falta ejecutar incorporación con la nueva sesión |
| 13. Login Cred | Ciudadano/Admin PASS, sesiones/cookies separadas, cruces403 y logout; perfiles/relaciones intactos |
| 14. Conteos | Canónico30personas/31fuentes/32credenciales/39versiones/eventos/operaciones sin cambios. Cred4Auth/1perfil/1verificación/1vínculo/5shares/9accesos. Segundo perfil Sergio no restaurado por decisión del propietario |
| 15. Migraciones | Diez históricas por proyecto conservadas. Solo RAES añade20261109161812 y20261109162351; Credenly sin DDL nuevo |
| 16. Baseline | Aplicado47huellas Poli +97UdeA;144inmutables, dos cortes, cero desconocidos y pendientes iniciales |
| 17. Clasificación | Todas las históricas YA PRESENTES; revisión PENDIENTE Y NECESARIA con timestamp REQUIERE RECONCILIACIÓN, resuelto solo para la nueva. Corrección de timestamps de catálogo necesaria/aplicada. Sin replay/repair/reset |
| 18. Calidad | ESLint real0errores; typecheck/builds0;262/262tests (25SQL);26/26browser; RLS/grants/advisors y exclusión HTTP real comprobados |
| 19. Commits | Separados localmente: reconexión, esquema/contratos, conectores/baseline, API, web/browser, operador/fixture y metadatos Next; documentación en commit separado |
| 20. Riesgos | Prueba remota de incorporación/limpieza pendiente. HIBP, recuperación/operación/identidad real y PR#16 siguen separados. No push/PR nuevo hasta cerrar esta prueba; sin merge/deploy |

Los incrementos de auditoría y timestamps de uso por lecturas reales son legítimos;
no son duplicación académica. Antes del nuevo flujo se observaron auditoría RAES159
(frente a145 restaurada) y Credenly79(frente a74); el corte añade dos auditorías
mínimas y las lecturas posteriores pueden incrementar la primera.

No se imprimen contraseñas, tokens, claves ni documentos reales. Escaneo adicional
contra los secretos locales efectivos:0 coincidencias; ningún .env, traineddata,
dump o backup se incluye en Git. Bootstrap son solo dos DDL históricos de aplicación
por checksum; no incluye esquemas internos Supabase.

Guías y evidencia: [revisión académica](../academic-review.md),
[reconexión](supabase-reconnection-2026-11-09.md) y JSON en `evidence/`.
No se declara listo para producción ni se afirma que haya pasado la prueba remota.
