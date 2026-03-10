import { ethers } from "ethers";
import { CONFIG } from "./config";

const provider = new ethers.JsonRpcProvider(CONFIG.infuraApiUrl);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

// --------------- ABIs ---------------

const PROJECT_TOKEN_FACTORY_ABI = [
  "function createToken(string _projectId, string _name, string _symbol) external returns (address)",
  "function getToken(string _projectId) external view returns (address)",
  "function totalProjects() external view returns (uint256)",
];

const PROJECT_TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function burnFrom(address account, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function setManager(address _manager) external",
  "function projectId() external view returns (string)",
];

const CREDIT_POOL_ABI = [
  "function deposit(address _token, uint256 _amount) external",
  "function withdraw(uint256 _secAmount) external",
  "function claimActualCredits(uint256 _secAmount) external",
  "function registeredTokenCount() external view returns (uint256)",
  "function accAllocatedToPool() external view returns (uint256)",
];

const CREDIT_MANAGER_ABI = [
  "function registerProject(string _projectId, uint256 _weight) external",
  "function mature(string _projectId) external",
  "function offset(address holder, uint256 amount) external",
  "function mintAcc(address to, uint256 amount) external",
  "function projects(string) external view returns (address tokenAddress, uint256 weight, bool mature)",
];

const SEC_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

const ACC_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

// --------------- Contract instances ---------------

const factoryContract = new ethers.Contract(
  CONFIG.projectTokenFactoryAddress,
  PROJECT_TOKEN_FACTORY_ABI,
  wallet
);

const poolContract = new ethers.Contract(
  CONFIG.creditPoolAddress,
  CREDIT_POOL_ABI,
  wallet
);

const managerContract = new ethers.Contract(
  CONFIG.creditManagerAddress,
  CREDIT_MANAGER_ABI,
  wallet
);

const secTokenContract = new ethers.Contract(
  CONFIG.secTokenAddress,
  SEC_TOKEN_ABI,
  wallet
);

const accTokenContract = new ethers.Contract(
  CONFIG.actualCreditAddress,
  ACC_TOKEN_ABI,
  wallet
);

function getProjectTokenContract(tokenAddress: string) {
  return new ethers.Contract(tokenAddress, PROJECT_TOKEN_ABI, wallet);
}

// --------------- Factory ---------------

export async function createProjectToken(
  projectId: string,
  name: string,
  symbol: string
): Promise<{ tokenAddress: string; txHash: string }> {
  const tx = await factoryContract.createToken(projectId, name, symbol);
  const receipt = await tx.wait();
  const tokenAddress = await factoryContract.getToken(projectId);
  return { tokenAddress, txHash: receipt.hash };
}

// --------------- Minting (on purchase) ---------------

export async function mintProjectTokens(
  tokenAddress: string,
  to: string,
  amount: number
): Promise<string> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await ptContract.mint(to, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Pool ---------------

export async function depositToPool(
  tokenAddress: string,
  amount: number
): Promise<string> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const weiAmount = ethers.parseEther(amount.toString());
  const approveTx = await ptContract.approve(CONFIG.creditPoolAddress, weiAmount);
  await approveTx.wait();
  const tx = await poolContract.deposit(tokenAddress, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function withdrawFromPool(secAmount: number): Promise<string> {
  const weiAmount = ethers.parseEther(secAmount.toString());
  const tx = await poolContract.withdraw(weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function claimActualCreditsFromPool(secAmount: number): Promise<string> {
  const weiAmount = ethers.parseEther(secAmount.toString());
  const tx = await poolContract.claimActualCredits(weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Maturity ---------------

export async function matureProject(projectId: string): Promise<string> {
  const tx = await managerContract.mature(projectId);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function burnPartialRtp(
  tokenAddress: string,
  amount: number
): Promise<string> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await ptContract.burnFrom(wallet.address, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function mintPartialAcc(amount: number): Promise<string> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await managerContract.mintAcc(wallet.address, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function getOnChainRtpBalance(tokenAddress: string): Promise<number> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const bal = await ptContract.balanceOf(wallet.address);
  return parseFloat(ethers.formatEther(bal));
}

export async function registerProject(
  projectId: string,
  weight: bigint
): Promise<string> {
  const tx = await managerContract.registerProject(projectId, weight);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Offset ---------------

export async function offsetCredits(
  holder: string,
  amount: number
): Promise<string> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await managerContract.offset(holder, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Transfer to user wallet (redeem) ---------------

export async function transferTokensToUser(
  tokenAddress: string,
  userWallet: string,
  amount: number
): Promise<string> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await ptContract.transfer(userWallet, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function transferAccToUser(
  userWallet: string,
  amount: number
): Promise<string> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await accTokenContract.transfer(userWallet, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function transferSecToUser(
  userWallet: string,
  amount: number
): Promise<string> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await secTokenContract.transfer(userWallet, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Read-only helpers ---------------

export async function getProjectTokenBalance(
  tokenAddress: string,
  holder: string
): Promise<string> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const bal = await ptContract.balanceOf(holder);
  return ethers.formatEther(bal);
}

export async function getAccBalance(holder: string): Promise<string> {
  const bal = await accTokenContract.balanceOf(holder);
  return ethers.formatEther(bal);
}

export async function getSecBalance(holder: string): Promise<string> {
  const bal = await secTokenContract.balanceOf(holder);
  return ethers.formatEther(bal);
}

export { wallet, provider };
