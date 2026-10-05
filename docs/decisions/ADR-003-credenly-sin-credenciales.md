# ADR-003 — Credenly no almacena credenciales

**Estado:** Aceptada

Credenly nunca almacena credenciales académicas ni una réplica persistente de su estado.

Puede guardar referencias como `raes_persona_id` y `raes_credencial_id`.

Perfil, detalle y verificación pública consultan RAES.
