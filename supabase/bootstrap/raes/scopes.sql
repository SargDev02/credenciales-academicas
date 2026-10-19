-- Configuration dictionary only; no identities, keys or academic fixtures.
insert into public.scopes (codigo, descripcion) values
  ('credentials:annul', 'Anular credenciales académicas'),
  ('credentials:correct', 'Registrar correcciones como nuevas versiones de una credencial'),
  ('credentials:create', 'Registrar nuevas credenciales académicas'),
  ('credentials:read', 'Consultar credenciales autorizadas mediante RAES API'),
  ('credentials:revoke', 'Revocar credenciales académicas'),
  ('institution:sync', 'Sincronizar metadatos institucionales, sedes y programas'),
  ('persons:resolve', 'Resolver una persona maestra por identidad verificada'),
  ('persons:sync', 'Resolver y sincronizar personas reportadas por la institución')
on conflict (codigo) do nothing;
