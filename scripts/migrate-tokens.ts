import { ethers } from "ethers";
import { CONFIG } from "../src/lib/config";
import { createClient } from "@supabase/supabase-js";

const provider = new ethers.JsonRpcProvider(CONFIG.infuraApiUrl);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

const FACTORY_ABI = [
  "function createToken(string _projectId, string _name, string _symbol, uint256 _maxSupply) external returns (address)",
  "function getToken(string _projectId) external view returns (address)",
  "function totalProjects() external view returns (uint256)",
];

const MANAGER_ABI = [
  "function registerProject(string _projectId) external",
  "function projects(string) external view returns (address tokenAddress, bool registered)",
];

const factory = new ethers.Contract(CONFIG.projectTokenFactoryAddress, FACTORY_ABI, wallet);
const manager = new ethers.Contract(CONFIG.creditManagerAddress, MANAGER_ABI, wallet);
const supabase = createClient(CONFIG.supabaseUri, CONFIG.supabaseServiceRoleKey);

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

interface Project {
  id: string;
  name: string;
  token_address: string;
  totalShares: number;
}

function makeSymbol(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
}

async function main() {
  console.log("=== Token Migration: Deploy via Factory + Register on CreditManager ===\n");
  console.log("Wallet:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC\n");

  const { data: projects, error } = await supabase
    .from("property_data")
    .select("id, name, token_address, totalShares");

  if (error || !projects) {
    console.error("Failed to fetch projects:", error);
    return;
  }

  console.log(`Found ${projects.length} projects\n`);

  for (const project of projects as Project[]) {
    console.log(`--- ${project.name} (${project.id}) ---`);

    // Step 1: Check if already in factory
    const existingToken = await factory.getToken(project.id);
    if (existingToken !== ZERO_ADDR) {
      console.log("  Already in factory:", existingToken);
    } else {
      console.log("  Not in factory. Creating token...");
      const symbol = makeSymbol(project.name);
      const maxSupply = ethers.parseEther(project.totalShares.toString());
      console.log(`  Name: ${project.name}, Symbol: ${symbol}, MaxSupply: ${project.totalShares}`);

      try {
        const tx = await factory.createToken(project.id, project.name, symbol, maxSupply);
        console.log("  createToken tx:", tx.hash);
        const receipt = await tx.wait();
        console.log("  Confirmed in block:", receipt.blockNumber);

        const newTokenAddr = await factory.getToken(project.id);
        console.log("  New token address:", newTokenAddr);

        // Update DB
        const { error: updateErr } = await supabase
          .from("property_data")
          .update({ token_address: newTokenAddr })
          .eq("id", project.id);

        if (updateErr) {
          console.error("  DB update failed:", updateErr);
        } else {
          console.log("  DB updated with new token address");
        }
      } catch (e: any) {
        console.error("  createToken failed:", e.reason || e.message);
        continue;
      }
    }

    // Step 2: Register on CreditManager
    try {
      const projInfo = await manager.projects(project.id);
      if (projInfo.registered) {
        console.log("  Already registered on CreditManager");
      } else {
        console.log("  Registering on CreditManager...");
        const tx = await manager.registerProject(project.id);
        console.log("  registerProject tx:", tx.hash);
        const receipt = await tx.wait();
        console.log("  Confirmed in block:", receipt.blockNumber);
        console.log("  Registered successfully");
      }
    } catch (e: any) {
      console.error("  registerProject failed:", e.reason || e.message);
    }

    console.log("");
  }

  // Verify final state
  console.log("=== Verification ===\n");
  const totalInFactory = await factory.totalProjects();
  console.log("Total projects in factory:", totalInFactory.toString());

  for (const project of projects as Project[]) {
    const tokenAddr = await factory.getToken(project.id);
    const projInfo = await manager.projects(project.id);
    console.log(
      `${project.name}: factory=${tokenAddr !== ZERO_ADDR ? tokenAddr : "MISSING"}, registered=${projInfo.registered}`
    );
  }

  console.log("\n=== Migration Complete ===");
}

main().catch(console.error);
