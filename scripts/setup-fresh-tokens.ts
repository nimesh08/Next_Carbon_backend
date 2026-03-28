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

const PT_ABI = [
  "function setManager(address _manager) external",
  "function manager() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function maxSupply() external view returns (uint256)",
];

const factory = new ethers.Contract(CONFIG.projectTokenFactoryAddress, FACTORY_ABI, wallet);
const manager = new ethers.Contract(CONFIG.creditManagerAddress, MANAGER_ABI, wallet);
const supabase = createClient(CONFIG.supabaseUri, CONFIG.supabaseServiceRoleKey);

function makeSymbol(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 6);
}

async function main() {
  console.log("=== Deploy Project Tokens + Register + Set Manager ===\n");
  console.log("Wallet:", wallet.address);
  console.log("Factory:", CONFIG.projectTokenFactoryAddress);
  console.log("Manager:", CONFIG.creditManagerAddress, "\n");

  const { data: projects, error } = await supabase
    .from("property_data")
    .select("id, name, totalShares");

  if (error || !projects) {
    console.error("Failed to fetch projects:", error);
    return;
  }

  for (const project of projects) {
    console.log(`--- ${project.name} (${project.id}) ---`);

    const symbol = makeSymbol(project.name);
    const maxSupply = ethers.parseEther(project.totalShares.toString());

    // Step 1: Create token via factory
    console.log(`  Creating token: ${project.name} (${symbol}), maxSupply=${project.totalShares}...`);
    const tx = await factory.createToken(project.id, project.name, symbol, maxSupply);
    console.log("  tx:", tx.hash);
    await tx.wait();

    const tokenAddr = await factory.getToken(project.id);
    console.log("  Token deployed:", tokenAddr);

    // Step 2: Update DB
    await supabase.from("property_data").update({ token_address: tokenAddr }).eq("id", project.id);
    console.log("  DB updated");

    // Step 3: Set CreditManager as manager on ProjectToken
    const pt = new ethers.Contract(tokenAddr, PT_ABI, wallet);
    const setMgrTx = await pt.setManager(CONFIG.creditManagerAddress);
    await setMgrTx.wait();
    console.log("  Manager set to CreditManager");

    // Step 4: Register project on CreditManager
    const regTx = await manager.registerProject(project.id);
    await regTx.wait();
    console.log("  Registered on CreditManager");

    // Verify
    const mgr = await pt.manager();
    const info = await manager.projects(project.id);
    const ts = await pt.totalSupply();
    const ms = await pt.maxSupply();
    console.log(`  Verified: manager=${mgr}, registered=${info.registered}, totalSupply=${ethers.formatEther(ts)}, maxSupply=${ethers.formatEther(ms)}\n`);
  }

  console.log("=== Verification Summary ===");
  const total = await factory.totalProjects();
  console.log("Total projects in factory:", total.toString());

  const { data: verify } = await supabase.from("property_data").select("name, token_address, totalShares, available_shares, maturity_percentage");
  for (const p of (verify ?? [])) {
    console.log(`  ${p.name}: token=${p.token_address} shares=${p.available_shares}/${p.totalShares} maturity=${p.maturity_percentage}%`);
  }

  console.log("\n=== Setup Complete - Ready for testing! ===");
  console.log("\nFlow: Purchase (mints PT) -> Maturity (burns PT, mints VCC) -> Offset (burns VCC, mints NFT)");
}

main().catch(console.error);
