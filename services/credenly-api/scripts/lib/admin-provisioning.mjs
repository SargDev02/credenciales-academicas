// Operator-only orchestration. Never import into the web or API runtime.
export class ProvisionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ProvisionError";
    this.details = details;
  }
}
export function validatePassword(password, confirmation) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256 ||
    !password.trim() ||
    password !== confirmation
  )
    throw new ProvisionError(
      "Las contraseñas deben coincidir y tener entre 12 y 256 caracteres. Sin cambios.",
    );
}
export async function listAuthUsers(auth) {
  const users = [];
  for (let page = 1; page <= 100; page++) {
    const result = await auth.listUsers({ page, perPage: 100 });
    if (result.error || !Array.isArray(result.data?.users))
      throw new ProvisionError(
        "No se pudo completar el inventario Auth. Sin creación.",
      );
    users.push(...result.data.users);
    if (result.data.users.length < 100) return users;
  }
  throw new ProvisionError(
    "Inventario Auth incompleto: revisar paginación antes de crear.",
  );
}
export function assertEmailAvailable(users, email) {
  if (users.some((u) => u.email?.toLowerCase() === email.toLowerCase()))
    throw new ProvisionError(
      "El correo ya existe en Auth. No se reutiliza ni modifica esa cuenta.",
    );
}

export async function provisionAdmin({
  auth,
  profiles,
  email,
  nombres,
  apellidos,
  password,
  previousIds,
}) {
  // The caller repeats the read-only collision/data checks immediately beforehand.
  let created;
  try {
    created = await auth.createUser({ email, password, email_confirm: true });
  } catch {
    throw new ProvisionError(
      "Respuesta de creación Auth incierta. No reintentar ni borrar una cuenta sin identificarla.",
    );
  }
  const user = created.data?.user;
  if (created.error || !user)
    throw new ProvisionError(
      "Auth rechazó la creación. Comprobar el estado antes de reintentar.",
    );
  const fresh =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      user.id,
    ) &&
    !previousIds.has(user.id) &&
    user.email?.toLowerCase() === email;
  if (!fresh)
    throw new ProvisionError(
      "Auth no devolvió una identidad nueva demostrable. No se modifica ni elimina automáticamente.",
    );
  const profile = {
    id: user.id,
    nombres,
    apellidos,
    rol: "ADMIN_CREDENLY",
    estado: "ACTIVO",
  };
  try {
    await profiles.assertNoCitizenRelations(user.id);
    if (!user.email_confirmed_at)
      throw new Error("Missing operator confirmation");
    await profiles.insert(profile);
  } catch {
    // An ambiguous INSERT could have committed. Never force a FK or delete a profile.
    const observed = await profiles.find(user.id).catch(() => undefined);
    if (observed !== null)
      throw new ProvisionError(
        "No se pudo confirmar ausencia de perfil tras el fallo. Detenido sin forzar eliminación.",
        { createdId: user.id, compensation: "REQUIRES_REVIEW" },
      );
    const current = await auth.getUserById(user.id).catch(() => null);
    if (
      current?.error ||
      current?.data?.user?.id !== user.id ||
      current.data.user.email?.toLowerCase() !== email
    )
      throw new ProvisionError(
        "No se pudo confirmar la cuenta creada por esta ejecución. No se elimina automáticamente.",
        { createdId: user.id, compensation: "REQUIRES_REVIEW" },
      );
    try {
      await profiles.assertNoCitizenRelations(user.id);
    } catch {
      throw new ProvisionError(
        "Relaciones ciudadanas inesperadas; no se fuerza la eliminación Auth.",
        { createdId: user.id, compensation: "REQUIRES_REVIEW" },
      );
    }
    const removal = await auth.deleteUser(user.id).catch(() => null);
    const absent = await auth.getUserById(user.id).catch(() => null);
    if (
      !removal ||
      removal.error ||
      absent?.error?.status !== 404 ||
      (await profiles.find(user.id)) !== null
    )
      throw new ProvisionError(
        "Falló la compensación. Detenido; no forzar eliminaciones ni reintentar.",
        { createdId: user.id, compensation: "FAILED" },
      );
    throw new ProvisionError(
      "Falló el perfil; se eliminó exclusivamente el Auth recién creado y se verificó ausencia. No se reintenta.",
      { createdId: user.id, compensation: "AUTH_REMOVED_VERIFIED" },
    );
  }
  return profile;
}
