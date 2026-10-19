import "server-only";
import { readWebConfig } from "@raes/web-core/config";
export function getWebConfig() {
  return readWebConfig(process.env, "CREDENLY");
}
