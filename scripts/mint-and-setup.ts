import { ethers } from "ethers";
import { CONFIG } from "../src/lib/config";
import { createClient } from "@supabase/supabase-js";

const provider = new ethers.JsonRpcProvider(CONFIG.infuraApiUrl);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

const FACTORY_ABI = [
  "function getToken(string _projectId) external view returns (address)",
];

const PT_ABI = [
  "function mint(address to, uint256 amount) external",
  "function setManager(address _manager) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function maxSupply() external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function manager() external view returns (address)",
];

const factory = new ethers.Contract(CONFIG.projectTokenFactoryAddress, FACTORY_ABI, wallet);
const supabase = createClient(CONFIG.supabaseUri, CONFIG.supabaseServiceRoleKey);

async function main() {
  console.log("=== Mint PT Tokens + Set Manager ===\n");
  console.log("Wallet:", wallet.address);
  console.log("CreditManager:", CONFIG.creditManagerAddress, "\n");

  const { data: projects, error } = await supabase
    .from("property_data")
    .select("id, name, token_address, totalShares");

  if (error || !projects) {
    console.error("Failed to fetch projects:", error);
    return;
  }

  for (const project of projects) {
    console.log(`--- ${project.name} (${project.id}) ---`);

    const tokenAddr = await factory.getToken(project.id);
    console.log("  Factory token:", tokenAddr);

    const pt = new ethers.Contract(tokenAddr, PT_ABI, wallet);

    const currentSupply = await pt.totalSupply();
    const maxSupply = await pt.maxSupply();
    const walletBal = await pt.balanceOf(wallet.address);
    console.log("  Current supply:", ethers.formatEther(currentSupply));
    console.log("  Max supply:", ethers.formatEther(maxSupply));
    console.log("  Wallet balance:", ethers.formatEther(walletBal));

    // Mint full supply to company wallet if not already minted
    if (currentSupply.toString() === "0") {
      console.log("  Minting", ethers.formatEther(maxSupply), "PT to company wallet...");
      const tx = await pt.mint(wallet.address, maxSupply);
      console.log("  mint tx:", tx.hash);
      await tx.wait();
      console.log("  Minted");
    } else {
      console.log("  Already has supply, skipping mint");
    }

    // Set CreditManager as manager
    const currentManager = await pt.manager();
    if (currentManager.toLowerCase() !== CONFIG.creditManagerAddress.toLowerCase()) {
      console.log("  Setting CreditManager as manager...");
      const tx = await pt.setManager(CONFIG.creditManagerAddress);
      console.log("  setManager tx:", tx.hash);
      await tx.wait();
      console.log("  Manager set");
    } else {
      console.log("  Manager already set");
    }

    // Approve CreditManager to burn from company wallet
    console.log("  Approving CreditManager for max spend...");
    const approveTx = await pt.approve(CONFIG.creditManagerAddress, ethers.MaxUint256);
    console.log("  approve tx:", approveTx.hash);
    await approveTx.wait();
    console.log("  Approved");

    // Verify
    const newBal = await pt.balanceOf(wallet.address);
    console.log("  Final wallet balance:", ethers.formatEther(newBal), "PT\n");
  }

  console.log("=== Setup Complete ===");
}

main().catch(console.error);
