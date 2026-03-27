import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import {
  transferTokensToUser,
  transferVccToUser,
  transferCitToUser,
} from "../lib/ethers";
import { tokenRedeemSchema } from "../schemas/token.schema";

class TokenController {
  async redeemTokens(req: Request, res: Response) {
    const { success, data, error } = tokenRedeemSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ success: false, message: error.message, error });
      return;
    }

    try {
      // Check user's balance
      const { data: balanceData } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", data.tokenType)
        .single();

      if (!balanceData || balanceData.balance < data.amount) {
        res.status(400).json({
          success: false,
          error: `Insufficient ${data.tokenType} balance. Available: ${balanceData?.balance ?? 0}`,
        });
        return;
      }

      // Get property for token address
      const { data: propertyData } = await supabase
        .from("property_data")
        .select("token_address")
        .eq("id", data.propertyId)
        .single();

      let txHash = "";

      if (data.tokenType === "PT" && propertyData?.token_address) {
        txHash = await transferTokensToUser(
          propertyData.token_address,
          data.walletAddress,
          data.amount
        );
      } else if (data.tokenType === "VCC") {
        txHash = await transferVccToUser(data.walletAddress, data.amount);
      } else if (data.tokenType === "CIT") {
        txHash = await transferCitToUser(data.walletAddress, data.amount);
      }

      // Deduct from user_token_balances
      const newBalance = balanceData.balance - data.amount;
      if (newBalance <= 0) {
        await supabase
          .from("user_token_balances")
          .delete()
          .eq("id", balanceData.id);
      } else {
        await supabase
          .from("user_token_balances")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("id", balanceData.id);
      }

      res.status(200).json({
        success: true,
        message: `Redeemed ${data.amount} ${data.tokenType} to ${data.walletAddress}`,
        txHash,
      });
    } catch (err) {
      console.log("Redeem error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  async getBalances(req: Request, res: Response) {
    const userId = req.params.userId;

    const { data, error } = await supabase
      .from("user_token_balances")
      .select("*, property_data(name, image, token_address)")
      .eq("user_id", userId);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  }
}

export default new TokenController();
