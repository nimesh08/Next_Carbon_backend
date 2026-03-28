import { ethers } from "ethers";
import { CONFIG } from "./config";

const provider = new ethers.JsonRpcProvider(CONFIG.infuraApiUrl);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

// --------------- ABIs ---------------

const PROJECT_TOKEN_FACTORY_ABI = [
  "function createToken(string _projectId, string _name, string _symbol, uint256 _maxSupply) external returns (address)",
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
  "function maxSupply() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
];

const CREDIT_POOL_ABI = [
  "function deposit(address _token, uint256 _amount) external",
  "function withdraw(uint256 _citAmount) external",
  "function claimVCC(uint256 _citAmount) external",
  "function allocateVcc(uint256 _amount) external",
  "function registerProject(address _token) external",
  "function registeredTokenCount() external view returns (uint256)",
  "function vccInPool() external view returns (uint256)",
];

const CREDIT_MANAGER_ABI = [
  "function registerProject(string _projectId) external",
  "function partialMature(string _projectId, uint256 _percent) external",
  "function offset(address _holder, uint256 _amount, string _projectId, string _certificateURI) external returns (uint256)",
  "function mintVcc(address to, uint256 amount) external",
  "function projects(string) external view returns (address tokenAddress, bool registered)",
];

const CIT_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

const VCC_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const RETIREMENT_CERTIFICATE_ABI = [
  "function certificates(uint256 tokenId) external view returns (uint256 amount, string projectId, uint256 timestamp, address retiree)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function nextTokenId() external view returns (uint256)",
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

const citTokenContract = new ethers.Contract(
  CONFIG.secTokenAddress,
  CIT_TOKEN_ABI,
  wallet
);

const vccTokenContract = new ethers.Contract(
  CONFIG.actualCreditAddress,
  VCC_TOKEN_ABI,
  wallet
);

const certificateContract = new ethers.Contract(
  CONFIG.retirementCertificateAddress,
  RETIREMENT_CERTIFICATE_ABI,
  wallet
);

function getProjectTokenContract(tokenAddress: string) {
  return new ethers.Contract(tokenAddress, PROJECT_TOKEN_ABI, wallet);
}

// --------------- Factory ---------------

export async function createProjectToken(
  projectId: string,
  name: string,
  symbol: string,
  maxSupply: number
): Promise<{ tokenAddress: string; txHash: string }> {
  const weiMaxSupply = ethers.parseEther(maxSupply.toString());
  const tx = await factoryContract.createToken(projectId, name, symbol, weiMaxSupply);
  const receipt = await tx.wait();
  const tokenAddress = await factoryContract.getToken(projectId);
  return { tokenAddress, txHash: receipt.hash };
}

export async function setProjectTokenManager(
  tokenAddress: string,
  managerAddress: string
): Promise<string> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const tx = await ptContract.setManager(managerAddress);
  const receipt = await tx.wait();
  return receipt.hash;
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

export async function withdrawFromPool(citAmount: number): Promise<string> {
  const weiAmount = ethers.parseEther(citAmount.toString());
  const tx = await poolContract.withdraw(weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function claimVccFromPool(citAmount: number): Promise<string> {
  const weiAmount = ethers.parseEther(citAmount.toString());
  const tx = await poolContract.claimVCC(weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function getVccInPool(): Promise<number> {
  const bal = await poolContract.vccInPool();
  return parseFloat(ethers.formatEther(bal));
}

// --------------- Maturity ---------------

export async function partialMatureProject(
  projectId: string,
  percent: number
): Promise<string> {
  const tx = await managerContract.partialMature(projectId, percent);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function registerProject(projectId: string): Promise<string> {
  const tx = await managerContract.registerProject(projectId);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Offset with NFT Certificate ---------------

export async function offsetWithCertificate(
  holder: string,
  amount: number,
  projectId: string,
  certificateURI: string
): Promise<{ txHash: string }> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await managerContract.offset(holder, weiAmount, projectId, certificateURI);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
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

export async function transferVccToUser(
  userWallet: string,
  amount: number
): Promise<string> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await vccTokenContract.transfer(userWallet, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function transferCitToUser(
  userWallet: string,
  amount: number
): Promise<string> {
  const weiAmount = ethers.parseEther(amount.toString());
  const tx = await citTokenContract.transfer(userWallet, weiAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// --------------- Supply info (for pre-mint cap check) ---------------

export async function getTokenSupplyInfo(
  tokenAddress: string
): Promise<{ totalSupply: number; maxSupply: number }> {
  const pt = getProjectTokenContract(tokenAddress);
  const [total, max] = await Promise.all([pt.totalSupply(), pt.maxSupply()]);
  return {
    totalSupply: parseFloat(ethers.formatEther(total)),
    maxSupply: parseFloat(ethers.formatEther(max)),
  };
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

export async function getVccBalance(holder: string): Promise<string> {
  const bal = await vccTokenContract.balanceOf(holder);
  return ethers.formatEther(bal);
}

export async function getCitBalance(holder: string): Promise<string> {
  const bal = await citTokenContract.balanceOf(holder);
  return ethers.formatEther(bal);
}

export async function getOnChainPtBalance(tokenAddress: string): Promise<number> {
  const ptContract = getProjectTokenContract(tokenAddress);
  const bal = await ptContract.balanceOf(wallet.address);
  return parseFloat(ethers.formatEther(bal));
}

export { wallet, provider, factoryContract, poolContract, managerContract, certificateContract };
