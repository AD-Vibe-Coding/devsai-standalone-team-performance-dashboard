import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

/** Server-only Supabase client. Do not import this from src/ UI files. */
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
