type Environment = Record<string, string | undefined>;
export type Service = "raes-api" | "credenly-api" | "raes-web" | "credenly-web" | "poli" | "udea";
export function deploymentMode(env: Environment): "production" | "local" | "test" {
  const mode = env.APP_ENV ?? (env.NODE_ENV === "production" ? "production" : "local");
  if (!["production", "local", "test"].includes(mode)) throw new Error("Configuración inválida: APP_ENV");
  return mode as "production" | "local" | "test";
}
export function configurationUrl(value: string | undefined, name: string, production: boolean): URL {
  try {
    if (!value || value !== value.trim()) throw new Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    if (production && (url.protocol !== "https:" || url.pathname !== "/" ||
      /^(localhost|.*\.localhost|.*\.local|127\..*|0\..*|10\..*|192\.168\..*|169\.254\..*|172\.(1[6-9]|2\d|3[01])\..*|\[.*\])$/i.test(url.hostname))) throw new Error();
    return url;
  } catch { throw new Error(`Configuración inválida: ${name}`); }
}
const urls: Record<Service, string[]> = {
  "raes-api": ["RAES_SUPABASE_URL"],
  "credenly-api": ["CREDENLY_SUPABASE_URL", "RAES_API_BASE_URL"],
  "raes-web": ["RAES_WEB_SUPABASE_URL", "RAES_API_BASE_URL", "RAES_WEB_SITE_URL"],
  "credenly-web": ["CREDENLY_WEB_SUPABASE_URL", "CREDENLY_API_BASE_URL", "CREDENLY_WEB_SITE_URL"],
  poli: ["POLI_SUPABASE_URL", "RAES_API_BASE_URL"],
  udea: ["UDEA_SUPABASE_URL", "RAES_API_BASE_URL"],
};
const secrets: Record<Service, string[]> = {
  "raes-api": ["RAES_SUPABASE_SERVICE_ROLE_KEY", "RAES_ADMISSION_SECRET"],
  "credenly-api": ["CREDENLY_SUPABASE_SERVICE_ROLE_KEY", "RAES_CREDENLY_CLIENT_SECRET", "CREDENLY_ADMISSION_SECRET"],
  "raes-web": ["RAES_ADMISSION_SECRET"], "credenly-web": ["CREDENLY_ADMISSION_SECRET"],
  poli: ["POLI_SUPABASE_SERVICE_ROLE_KEY", "RAES_POLI_CLIENT_SECRET"],
  udea: ["UDEA_SUPABASE_SERVICE_ROLE_KEY", "RAES_UDEA_CLIENT_SECRET"],
};
export function validateProductionConfig(env: Environment, service: Service): void {
  for (const name of Object.keys(env)) if (env[name] && name.startsWith("NEXT_PUBLIC_") &&
    /SECRET|SERVICE_ROLE|PASSWORD|PRIVATE_KEY/.test(name)) throw new Error(`Variable pública prohibida: ${name}`);
  if (deploymentMode(env) !== "production") return;
  if(env.EXPOSURE_SCOPE !== "closed-synthetic-pilot") throw new Error("Configuración inválida: EXPOSURE_SCOPE");
  if(service.endsWith("-api")) {
    const ids=(env.PILOT_ALLOWED_USER_IDS??'').split(',');
    if(ids.length>100||!ids.every(id=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id.trim()))) throw new Error("Configuración inválida: PILOT_ALLOWED_USER_IDS");
  }
  if(service.endsWith("-web")) {
    const emails=(env.PILOT_ALLOWED_EMAILS??'').split(',');
    if(emails.length>100||!emails.every(email=>email.trim().length<=254&&/^\S+@\S+\.\S+$/.test(email.trim()))) throw new Error("Configuración inválida: PILOT_ALLOWED_EMAILS");
  }
  if (service.endsWith("-api") || service.endsWith("-web")) {
    if (!/^[a-z0-9-]{1,80}$/.test(env.TRUSTED_CLIENT_IP_HEADER ?? "")) throw new Error("Configuración inválida: TRUSTED_CLIENT_IP_HEADER");
  }
  const allowed = new Set(secrets[service]);
  for (const [name,value] of Object.entries(env)) if (value && (/SUPABASE_SERVICE_ROLE_KEY$|_ADMISSION_SECRET$/.test(name) || /(?:POLI|UDEA|CREDENLY)_CLIENT_SECRET$/.test(name)) && !allowed.has(name)) throw new Error(`Secreto ajeno al servicio: ${name}`);
  for (const name of urls[service]) configurationUrl(env[name], name, true);
  for (const name of secrets[service]) if (!env[name] || env[name].length < 32) throw new Error(`Configuración inválida: ${name}`);
  const clientPrefix = service === 'credenly-api' ? 'RAES_CREDENLY' : service === 'poli' ? 'RAES_POLI' : service === 'udea' ? 'RAES_UDEA' : null;
  if(clientPrefix) {
    if(!/^raes_cli_[A-Za-z0-9_-]{1,100}$/.test(env[clientPrefix+'_CLIENT_ID']??''))throw new Error(`Configuración inválida: ${clientPrefix}_CLIENT_ID`);
    if(!/^raes_sk_[A-Za-z0-9_-]{32,248}$/.test(env[clientPrefix+'_CLIENT_SECRET']??''))throw new Error(`Configuración inválida: ${clientPrefix}_CLIENT_SECRET`);
  }
  if(service.endsWith('-web')) {
    const name=(service==='raes-web'?'RAES':'CREDENLY')+'_WEB_SUPABASE_PUBLISHABLE_KEY',value=env[name]??'';
    let role:unknown;try{role=(JSON.parse(Buffer.from(value.split('.')[1]??'', 'base64url').toString()) as {role?:unknown}).role;}catch{/* Opaque publishable key. */}
    if(!value.startsWith('sb_publishable_')&&role!=='anon')throw new Error(`Configuración inválida: ${name}`);
  }
  const privileged = secrets[service].find(name => name.endsWith("SERVICE_ROLE_KEY"));
  if (privileged) {
    const value = env[privileged]!;
    let role: unknown;
    try { role = (JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString()) as {role?:unknown}).role; } catch { /* Modern secret keys are opaque. */ }
    if (!value.startsWith("sb_secret_") && role !== "service_role") throw new Error(`Configuración inválida: ${privileged}`);
  }
}
export function siteOrigin(env: Environment, product: "RAES" | "CREDENLY"): string {
  const name = `${product}_WEB_SITE_URL`, production = deploymentMode(env) === "production";
  return configurationUrl(env[name] ?? (!production ? `http://localhost:${product === "RAES" ? 3000 : 3003}` : undefined), name, production).origin;
}
