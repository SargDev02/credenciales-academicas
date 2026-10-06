import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { getServerEnv } from "./env";

let adminClient: SupabaseClient | undefined;

export function getCredenlySupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const env = getServerEnv();

  adminClient = createClient(
    env.CREDENLY_SUPABASE_URL,
    env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Client-Info": "credenly-api",
        },
      },
    },
  );

  return adminClient;
}
