import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "./env";

let adminClient: SupabaseClient | undefined;

export function getRaesSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const env = getServerEnv();

  adminClient = createClient(
    env.RAES_SUPABASE_URL,
    env.RAES_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input,init) => fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)}),
        headers: {
          "X-Client-Info": "raes-api",
        },
      },
    },
  );

  return adminClient;
}
