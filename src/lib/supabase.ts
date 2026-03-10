import { CONFIG } from "./config";
import { createClient } from "@supabase/supabase-js";

if (!CONFIG.supabaseUri || !CONFIG.supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables!");
}

export const supabase = createClient(
  CONFIG.supabaseUri,
  CONFIG.supabaseServiceRoleKey
);
