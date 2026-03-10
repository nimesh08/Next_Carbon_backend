import { config } from "dotenv";

config();

export const CONFIG = {
  port: process.env.PORT || 3000,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpaySecret: process.env.RAZORPAY_SECRET ?? "",
  supabaseUri: process.env.SUPABASE_URI ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  infuraApiUrl: process.env.INFURA_API_URL ?? "",
  privateKey: process.env.PRIVATE_KEY ?? "",
  companyAddress: process.env.COMPANY_ADDRESS ?? "",
  creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS ?? "",
  projectTokenFactoryAddress: process.env.PROJECT_TOKEN_FACTORY_ADDRESS ?? "",
  creditPoolAddress: process.env.CREDIT_POOL_ADDRESS ?? "",
  actualCreditAddress: process.env.ACTUAL_CREDIT_ADDRESS ?? "",
  secTokenAddress: process.env.SEC_TOKEN_ADDRESS ?? "",
};
