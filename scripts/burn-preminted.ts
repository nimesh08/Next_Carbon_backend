import { ethers } from "ethers";
import { CONFIG } from "../src/lib/config";
import { createClient } from "@supabase/supabase-js";

const provider = new ethers.JsonRpcProvider(CONFIG.infuraApiUrl);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

const FACTORY_ABI = [
  "function getToken(string _projectId) external view returns (address)",
];

const PT_ABI = [
  "function burnFrom(address account, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function maxSupply() external view returns (uint256)",
];

const factory = new ethers.Contract(CONFIG.projectTokenFactoryAddress, FACTORY_ABI, wallet);
const supabase = createClient(CONFIG.supabaseUri, CONFIG.supabaseServiceRoleKey);

async function main() {
  console.log("=== Burn Pre-Minted PT Tokens ===\n");
  console.log("Wallet (owner):", wallet.address, "\n");

  const { data: projects, error } = await supabase
    .from("property_data")
    .select("id, name, token_address, totalShares");

  if (error || !projects) {
    console.error("Failed to fetch projects:", error);
    return;
  }

  console.log(`Found ${projects.length} projects\n`);

  for (const project of projects) {
    console.log(`--- ${project.name} (${project.id}) ---`);

    const tokenAddr = await factory.getToken(project.id);
    console.log("  Token address:", tokenAddr);

    const pt = new ethers.Contract(tokenAddr, PT_ABI, wallet);

    const totalSupply = await pt.totalSupply();
    const maxSupply = await pt.maxSupply();
    const walletBal = await pt.balanceOf(wallet.address);

    console.log("  totalSupply:", ethers.formatEther(totalSupply));
    console.log("  maxSupply:", ethers.formatEther(maxSupply));
    console.log("  company wallet balance:", ethers.formatEther(walletBal));

    if (walletBal.toString() === "0") {
      console.log("  Nothing to burn, skipping\n");
      continue;
    }

    console.log("  Burning", ethers.formatEther(walletBal), "PT from company wallet...");
    const tx = await pt.burnFrom(wallet.address, walletBal);
    console.log("  burn tx:", tx.hash);
    await tx.wait();
    console.log("  Burned");

    const newSupply = await pt.totalSupply();
    const newBal = await pt.balanceOf(wallet.address);
    console.log("  After burn -> totalSupply:", ethers.formatEther(newSupply), "balance:", ethers.formatEther(newBal));

    if (newSupply.toString() !== "0") {
      console.warn("  WARNING: totalSupply is not 0 after burn! There may be tokens held elsewhere.");
    } else {
      console.log("  OK: totalSupply is 0");
    }
    console.log("");
  }

  console.log("=== Burn Complete ===");
}

main().catch(console.error);
