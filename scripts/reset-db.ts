import { createClient } from "@supabase/supabase-js";
import { CONFIG } from "../src/lib/config";

const supabase = createClient(CONFIG.supabaseUri, CONFIG.supabaseServiceRoleKey);

async function main() {
  console.log("=== Full Database Reset ===\n");

  const tables = [
    "user_token_balances",
    "owners",
    "payments",
    "offset",
    "maturity_events",
    "available_retirements",
    "retirement_certificates",
    "pool_deposits",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.log(`  ${table}: ERROR - ${error.message}`);
      const { error: err2 } = await supabase.from(table).delete().gte("id", 0);
      if (err2) {
        console.log(`  ${table}: retry ERROR - ${err2.message}`);
      } else {
        console.log(`  ${table}: cleared (retry)`);
      }
    } else {
      console.log(`  ${table}: cleared`);
    }
  }

  console.log("\nResetting property_data fields...");
  const { data: projects } = await supabase
    .from("property_data")
    .select("id, name, totalShares");

  for (const p of (projects ?? [])) {
    const { error } = await supabase
      .from("property_data")
      .update({
        available_shares: p.totalShares,
        maturity_percentage: 0,
        is_mature: false,
        token_address: null,
      })
      .eq("id", p.id);

    if (error) {
      console.log(`  ${p.name}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${p.name}: available_shares=${p.totalShares}, maturity=0%, token_address=null`);
    }
  }

  console.log("\n=== Verifying clean state ===");
  for (const table of tables) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
    console.log(`  ${table}: ${count} rows`);
  }

  const { data: verify } = await supabase
    .from("property_data")
    .select("name, totalShares, available_shares, maturity_percentage, is_mature, token_address");
  for (const p of (verify ?? [])) {
    console.log(`  ${p.name}: shares=${p.available_shares}/${p.totalShares} maturity=${p.maturity_percentage}% token=${p.token_address}`);
  }

  console.log("\n=== Database Reset Complete ===");
}

main().catch(console.error);
