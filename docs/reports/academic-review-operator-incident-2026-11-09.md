# Incidencia del operador de revisión académica

Fecha: 2026-11-09. Rama: `feat/raes-academic-review`. Alcance exclusivo de
investigación y herramientas; ningún cambio en endpoints, dominio, esquema,
fixtures, baseline o datos institucionales. PR #16 intacto; sin merge ni despliegue.

## Conclusión y límite causal

**El disparador exacto del FAIL histórico no puede identificarse a partir de la
evidencia conservada. No se declara resuelta con certeza esa causalidad.** El
postcheck exitoso valida estado e invariantes; no reconstruye una excepción perdida.

Sí se identificaron y corrigieron defectos concretos del operador:

1. En la fuente anterior a instrumentación, conservada en `7636a2c`, el bloque
   final completo mantenía `stage='APPROVAL_B'`. Cualquier fallo de conteos,
   subproceso detector, parsing de salida o replay HTTP se etiquetaba igual.
2. `catch { ... }` descartaba excepción/cause/exitCode/signal y no guardaba los
   valores intermedios. La evidencia no contiene el contador `stable`, stdout del
   detector, respuesta de replay ni código del error. Estos datos ya no están
   disponibles; no se inventa una aserción ni una explicación de red/timing.
3. `--resume` presupone explícitamente `canonical.data.version_actual === 1` y
   título A. El fixture ya está aprobado en B/v2. Repetir ese modo falla en
   PRECHECK por una expectativa de estado inadecuada para comprobar un flujo
   terminado. **Este fallo actual no se confunde con el antiguo FAIL posterior a B.**

Clasificación: defectos de diagnóstico/reanudación del operador confirmados;
ningún defecto funcional o de limpieza reproducido. El desencadenante histórico
permanece indeterminado, no demostrado como timing, transporte, aserción o comando.
La evidencia histórica confirma que B fue leído por HTTP y la limpieza pasó.

## Reproducción segura

`reproduce-academic-review-fail.mjs` extrae exclusivamente el bloque final y su
catch de la fuente Git histórica y lo ejecuta con dependencias locales simuladas.
No carga env, no crea clientes ni hace peticiones. Fuente SHA-256:
`698df719c1657426561764662dda99a6695d2ba6eb7411f678e50728869f4e87`.

```bash
pnpm --filter @raes/api exec node scripts/reproduce-academic-review-fail.mjs
```

El caso válido pasa. Cuatro fallos distintos —subproceso, transporte de replay,
propuesta inesperada y diferencia de conteos— producen exactamente el mismo
`FAIL / APPROVAL_B` histórico. Es una demostración de pérdida de información,
**no una afirmación de que una de esas causas simuladas ocurrió remotamente**.

También se ejecutó `--resume --check` contra el estado B sin escrituras: exit 1,
`RESUME_EXPECTS_VERSION_A_USE_VERIFY_COMPLETED`, PRECHECK. No se modificó ni se
rebobinó el fixture para conseguir una reproducción.

La hipótesis de una conexión caducada tras `execFileSync` se ensayó en HTTP local
y con una petición anónima a RAES: no se reprodujo. No se cambió ejecución de
subprocesos ni se añadieron retries especulativos a decisiones.

## Corrección del operador

- Verificación final compartida con etapas separadas para conteos iniciales,
  detección, replay y conteos posteriores; cada condición tiene código explícito.
- Diagnósticos acotados: tipo de excepción, cause.code de red, exitCode/signal del
  subproceso, HTTP status o tabla/conteo que difiere. No se guardan mensajes,
  stacks, stdout/stderr completos, cabeceras, cuerpos, contraseñas o tokens.
- Contadores deben ser enteros no negativos: un count null no se acepta como
  medición válida. Comparación por tabla, independiente del orden de claves.
- Modo `--verify-completed` para el fixture B/v2 ya aprobado, sin contraseña,
  creación de cuenta, OCR, cambios fuente ni aprobación nueva. Reutiliza el mismo
  bloque final instrumentado. La RPC de replay se ejecuta como service_role en
  ROLLBACK; no se presenta como replay HTTP remoto.
- Postcheck reutiliza ese mismo bloque. Resultados nuevos en rutas únicas y
  creación exclusiva; los tres JSON históricos permanecen idénticos byte a byte
  respecto del commit `cd93f49`. El archivo temporal histórico tampoco se reemplaza.

```bash
pnpm --filter @raes/api exec node scripts/verify-academic-review-live.mjs --verify-completed
pnpm --filter @raes/api exec node scripts/verify-academic-review-postcheck.mjs
```

Ambos comandos corregidos: **PASS, exit 0**. No ejecutar los modos inicial o
`--resume` para volver a incorporar este fixture; sus precondiciones A se conservan.

## Regresiones y calidad

12 pruebas nuevas cubren éxito, conteos reordenados, count inválido, error de
subproceso, JSON ausente/duplicado, propuestas nuevas, canonicalWrites distinto de
cero, causa de red, HTTP denegado, respuesta sin replay, diferencia exacta de tabla
y redacción de secretos. Todos los fallos indican la etapa correcta.

```bash
node --test scripts/test/academic-review-operator.test.mjs
pnpm lint
pnpm typecheck
pnpm test
```

12/12 afectadas; suite completa **282/282** (245 de paquetes + 25 SQL + 12 operador).
Las afectadas se repitieron tras añadir tipo de excepción al diagnóstico. Lint y
typecheck correctos. No se requieren nuevos builds: no cambió código de aplicación.

## Invariantes comprobadas de nuevo

- Cero solicitudes PENDIENTE inesperadas antes/después. Siguen las dos APROBADAS.
- RAES conserva 31 personas, 32 fuentes, 33 credenciales y 41 versiones/eventos/
  operaciones. Huellas de las once tablas canónicas idénticas antes/después.
- Cero Auth, identidades, sesiones y relaciones ciudadanas de los dos UUID
  temporales históricos. No se crearon nuevas cuentas ni sesiones ciudadanas.
- Perfiles/verificaciones/vínculos/shares/accesos y campos de identidad Auth de
  Valentina y ambos admins conservados por huellas, excluyendo secretos.
- Único perfil ciudadano: UUID de Valentina. Sergio continúa sin perfil por
  decisión del propietario; no se restaura.
- Poli y UdeA: detección idempotente del fixture existente, cero propuestas nuevas
  y `canonicalWrites: 0`. Ninguna escritura en bases institucionales.
- Cliente real de Credenly y función de consulta con vínculo existente: tres
  peticiones a RAES API con no-store, cero RAES DB/fuentes/persistencia académica.
  Conserva REVOCADA v3 / ANULADA v2 y las dos VIGENTE multiinstitución.
  Es una comprobación server-side sin crear una sesión ciudadana; no se etiqueta
  como un login o un nuevo GET ciudadano autenticado.

Evidencias nuevas: [directorio separado](evidence/operator-incident-2026-11-09/).
Incluyen las dos ejecuciones reales, reproducción offline, expectativa A/B,
lectura viva, detección UdeA e integridad SHA de los tres archivos históricos.

## Riesgo restante real

La excepción original se perdió y su disparador no es atribuible con certeza.
Los fallos actuales tienen diagnóstico verificable y el modo de comprobación
terminado pasa, pero eso no convierte retrospectivamente el FAIL antiguo en PASS.
La investigación causal histórica queda indeterminada; inventar su causa o declarar
cerrado ese punto con certeza sería incorrecto. No queda un defecto académico o
residuo temporal reproducido en esta fase.
