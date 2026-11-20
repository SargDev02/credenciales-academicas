# Cierre técnico anterior al despliegue — 2026-11-20

El propietario precisó: «No vamos a hacer despliegue, quiero que el proyecto quede
en perfectas condiciones pero no hasta el despliegue». El alcance de este cierre
es la calidad y reproducibilidad del repositorio del **piloto cerrado sintético**.
No se afirma preparación operativa de una plataforma pública con personas reales.

Base validada: main `6707547a51a96e37e4e40c689e1f5767d1381476`, PR #16/#17/#18
integrados. Rama de cierre: `codex/pilot-completion`. Esta rama modifica únicamente
documentación y evidencia saneada; el runtime validado es idéntico al de main.

## Resultado

**Cierre técnico predespliegue: PASS.** No quedan gates locales fallidos ni defectos
funcionales identificados en esta comprobación. No se añadieron funcionalidades,
dependencias, excepciones de seguridad, migraciones ni cambios de arquitectura.

[Evidencia de gates y hashes de logs](evidence/predeployment-closeout-2026-11-20.json).
Los logs completos y los backups están fuera del repositorio; no se suben a GitHub.

| Comprobación | Resultado |
| --- | --- |
| Node / pnpm fijados | 24.22.0 / 12.8.1 |
| Instalación frozen desde worktree limpio | PASS |
| Escaneo de secretos / historial reciente | PASS |
| Archivo DDL | 22 históricos + 5 correctivos + 2 académicos + 2 productivos verificados |
| Lint tipado, todos los workspaces y tooling | PASS, sin warnings |
| RAES Web typecheck en instalación limpia | PASS |
| Typecheck completo + next typegen | PASS |
| Suite completa | 368/368; 0 fallos, 0 omitidos |
| Audit producción | 0 vulnerabilidades conocidas |
| Gate audit completo | PASS, findings [] |
| Builds | 5/5: contracts, dos APIs y dos webs |
| Navegador principal | 34/34 |
| Navegador académico | 9/9 |
| Reconstrucción de cuatro esquemas / seguridad DB | PASS dentro de la suite local |
| Composición archivo → hardening → revisión → producción | PASS dentro de la suite local |
| Ensayo local backup/restore WASM | PASS dentro de la suite local |
| OCR real con píxeles sintéticos | PASS, cero escrituras DB |
| Operador --verify-completed --local | PASS, canonicalWrites:0 |
| Postcheck --local | PASS, canonicalWrites:0 |
| Configuración local de los cuatro procesos | PASS sin peticiones remotas |

El worktree de calidad empezó sin .env ni artefactos generados. No se copiaron
credenciales ni backups al entorno de tests. Los casos browser usan fixtures
locales de API/Auth/DB y aplicaciones Next compiladas; no son un nuevo login real
contra Supabase alojado. La comprobación adicional de los .env.local del operador
solo analizó configuración en memoria, sin imprimir valores ni conectar a las bases:
cada web coincide con el proyecto Auth de su API, los productos están separados y
las URLs locales API coinciden con los puertos documentados 3001/3002.

Las pruebas cubren CSP/nonce, no-store, Server Actions, cookies y recuperación
separadas; estados SUSPENDIDO/CERRADO, exclusión ciudadano/admin, permisos mínimos,
AUDITOR solo lectura, aprobación/rechazo/superseded, replays, consultas vivas a RAES,
retención dry-run y cuotas PostgreSQL compartidas. La detección institucional
mantiene canonicalWrites:0; Credenly continúa sin persistencia académica.

Next sigue en 16.4.6 en las cuatro aplicaciones, React/ReactDOM en 19.2.8 y Zod en
^4.6.7. El override minimatch permanece limitado al parser documentado. La excepción
histórica braces venció el 18-11-2026, no se amplió y no participa en el PASS actual.
El audit expresa el estado del registro en esta fecha; no es una garantía futura.

## Documentación corregida

- README: estado real de PR #16/#17/#18 y enlace a este cierre.
- Desarrollo: arranque local de las dos APIs y dos webs, .env por proceso, health
  frente a readiness, accesos separados y operación explícita de conectores.
- RAES API: se retiraron afirmaciones de interfaces futuras y se distinguieron
  rutas históricas protegidas del workflow actual de revisión académica.
- Preparación del piloto/progreso: cierre del repositorio frente a activación futura.
- Se conservaron sin reescribir evidencias, incidentes y resultados históricos.

No se añadieron tests que solo repitan documentación: no cambió el runtime, y la
suite completa vuelve a acreditar las regresiones existentes.

## Backup y preservación

A1-R ya terminó PASS el 20-11-2026: dumps nativos y Auth/historial separados,
cifrados fuera de Git, SHA-256/AEAD y backup:verify PASS en los dos bundles.
Restore nativo PostgreSQL17 y segundo replay offline PASS; 52 tablas RAES y 35
Credenly comparadas, con filas/relaciones, owners, roles, grants, RLS, constraints,
PK/FK, triggers y RPC conservados. Los datos Auth restaurados no certifican GoTrue,
SMTP, JWT signing, redirects ni recovery alojados.

La última evidencia remota autorizada A1-R conserva baseline 47+97=144,
pendientes0, Credenly cuatro Auth/un perfil ciudadano/un administrativo y la omisión
del perfil ciudadano de Sergio por decisión deliberada. Este cierre no vuelve a
crear fixtures, ejecutar baseline, aprobar propuestas ni consultar cuentas para
repetir esa validación. No se restablecieron contraseñas ni se rotaron secretos.

## Activación futura, fuera de este cierre

Las siguientes acciones requieren un entorno de despliegue concreto; su ausencia
no se oculta mediante casillas aprobadas ni configuración inventada:

1. Elegir orígenes HTTPS/hosting e ingress cerrado; configurar cohorte y monitores.
2. Aplicar por separado las dos migraciones productivas ya versionadas, usando los
   backups recuperables y el plan transaccional A2. Siguen SIN aplicar.
3. Configurar y comprobar Auth alojado, signup del piloto, redirects exactos,
   sesiones, SMTP y entrega/recuperación/revocación reales. No enviar correos aquí.
4. Establecer custodia/rotación de secretos, copia independiente cifrada y RPO/RTO;
   aprobar retención y frecuencia/responsables de conectores y alertas.
5. Resolver la política de contraseñas filtradas y verificar red/servicios antes
   de cualquier apertura. Longitud mínima y audit npm no reemplazan este control.

La [lista operacional](../production/README.md#b-acciones-externas-finales) y la
[matriz por proceso](../environment.md#configuración-productiva-del-piloto-cerrado-2026-11-19)
contienen los comandos, variables y dependencias; no se duplican aquí. La plantilla
owner-inputs sigue intencionalmente bloqueada: no se atestiguan acciones no hechas.
OCR no prueba identidad real: cualquier cambio futuro a datos/personas reales
exige revisar esa garantía antes de ampliar el alcance aprobado.

## Git y CI

El CI de main `6707547` terminó success:
[run 44660764665](https://github.com/SargDev02/credenciales-academicas/actions/runs/44660764665).
La rama de cierre se entrega en un PR Draft hacia main y su CI se consulta sobre
el head publicado; no se hace merge ni despliegue. El commit de documentación no
cambia la versión del runtime evaluado. Esta evidencia conserva los resultados
locales y no sustituye las comprobaciones del PR en GitHub.
