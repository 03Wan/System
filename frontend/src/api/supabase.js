import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep runtime warning lightweight; app can still run in Flask mode.
  // eslint-disable-next-line no-console
  console.warn("Supabase env is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when using supabase backend.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

export function buildApiResponse(data) {
  return { code: 0, message: "ok", data };
}

export function toApiError(message, status = 400) {
  const err = new Error(message || "请求失败");
  err.response = { status, data: { message } };
  return err;
}


