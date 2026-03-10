import { z } from "zod";

export const tokenRedeemSchema = z.object({
  userId: z.string({ message: "Please provide a valid user id" }),
  propertyId: z.string({ message: "Please provide a valid property id" }),
  tokenType: z.enum(["RTP", "SEC", "ACC"], { message: "Token type must be RTP, SEC, or ACC" }),
  amount: z.number({ message: "Amount must be a valid number" }).positive(),
  walletAddress: z.string({ message: "Please provide a valid wallet address" }),
});

export const poolDepositSchema = z.object({
  userId: z.string({ message: "Please provide a valid user id" }),
  propertyId: z.string({ message: "Please provide a valid property id" }),
  amount: z.number({ message: "Amount must be a valid number" }).positive(),
});

export const poolWithdrawSchema = z.object({
  userId: z.string({ message: "Please provide a valid user id" }),
  secAmount: z.number({ message: "SEC amount must be a valid number" }).positive(),
});

export const poolClaimSchema = z.object({
  userId: z.string({ message: "Please provide a valid user id" }),
  secAmount: z.number({ message: "SEC amount must be a valid number" }).positive(),
});
