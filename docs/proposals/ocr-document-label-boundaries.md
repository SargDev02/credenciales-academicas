# Corrección mínima del parser OCR — autorizada y aplicada

La prueba sintética real falló después de incorporar el fixture académico. OCR
HTTP201, Tesseract local reconoce exactamente `SYNTH-RVW-20261109-001` con confianza
0.93. El parser devuelve `MBRES`, porque `N[O°]` encuentra `NO` dentro de `NOMBRES`.
El operador comprueba identidad esperada y se detiene, sin vincular la incorrecta.
La cuenta temporal y sus relaciones se eliminaron; persona/credencial aprobadas
se conservan. El diagnóstico se reprodujo localmente sin escrituras remotas.

Cambio autorizado por el propietario y aplicado exclusivamente en `services/credenly-api/src/lib/ocr-document-parser.ts`:

```diff
- /(?:NUIP|NUMERO|N[O°])\s*[:#-]?\s*([A-Z0-9.-]{5,24})/
+ /(?:^|\s)(?:NUIP|NUMERO|N[O°])(?=\s|[:#-])\s*[:#-]?\s*([A-Z0-9.-]{5,24})/
- /(?:DOCUMENTO|IDENTIFICACION)\s*[:#-]?\s*([A-Z0-9.-]{5,24})/
+ /(?:^|\s)(?:DOCUMENTO|IDENTIFICACION)(?=\s|[:#-])\s*[:#-]?\s*([A-Z0-9.-]{5,24})/
```

Exige una etiqueta completa y separada; no cambia formatos de documento,
thresholds OCR, estados, endpoints, RPC, esquema, identidad ni datos existentes.
No contiene excepciones para el fixture. Añadir regresiones de DOCUMENTO seguido
por NOMBRES, NOMBRES sin número y variantes NO/N°/NUIP/NUMERO/IDENTIFICACION.

Antes de pedir de nuevo la contraseña, repetir el diagnóstico local usando el
mismo render y parser productivo. Luego reanudar solo la fase ciudadana/corrección
sobre los UUID aprobados: jamás reinsertar/adoptar filas por colisión.

Resultado local:13/13 tests del parser (ocho regresiones nuevas), diagnóstico
Tesseract real con tres renders: identificador correcto, APROBADA y confianza
0.93/0.93/0.90. Lint/typecheck/builds pasan; suite completa270/270 (incluye25SQL).
No se modificaron estados ni verificaciones existentes. Se reanudará la fase
ciudadana con `--resume`, tras validar por read-only los UUID/versiónA aprobados.
