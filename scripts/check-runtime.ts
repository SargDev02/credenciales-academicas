import { validateProductionConfig, type Service } from "../packages/web-core/src/deployment";
const service=process.argv[2];
if(!service || !["raes-api","credenly-api","raes-web","credenly-web","poli","udea"].includes(service))throw new Error("Servicio de configuración no válido");
try { validateProductionConfig(process.env,service as Service); }
catch(error) { console.error(error instanceof Error ? error.message : "Configuración inválida"); process.exitCode=1; }
