import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import {
  depositToPool,
  withdrawFromPool,
  claimVccFromPool,
} from "../lib/ethers";
import {
  poolDepositSchema,
  poolWithdrawSchema,
  poolClaimSchema,
} from "../schemas/token.schema";

class PoolController {
  async deposit(req: Request, res: Response) {
    const { success, data, error } = poolDepositSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ success: false, message: error.message, error });
      return;
    }

    try {
      const { data: ptBalance } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", "PT")
        .single();

      if (!ptBalance || ptBalance.balance < data.amount) {
        res.status(400).json({
          success: false,
          error: `Insufficient PT balance. Available: ${ptBalance?.balance ?? 0}`,
        });
        return;
      }

      const { data: propertyData } = await supabase
        .from("property_data")
        .select("token_address")
        .eq("id", data.propertyId)
        .single();

      if (!propertyData?.token_address) {
        res.status(400).json({ success: false, error: "Property has no token" });
        return;
      }

      const txHash = await depositToPool(propertyData.token_address, data.amount);

      const citReceived = data.amount; // 1:1

      // Deduct PT
      const newPt = ptBalance.balance - data.amount;
      if (newPt <= 0) {
        await supabase.from("user_token_balances").delete().eq("id", ptBalance.id);
      } else {
        await supabase
          .from("user_token_balances")
          .update({ balance: newPt, updated_at: new Date().toISOString() })
          .eq("id", ptBalance.id);
      }

      // Add CIT balance
      const { data: existingCit } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", "CIT")
        .single();

      if (existingCit) {
        await supabase
          .from("user_token_balances")
          .update({
            balance: existingCit.balance + citReceived,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCit.id);
      } else {
        await supabase.from("user_token_balances").insert([{
          user_id: data.userId,
          property_id: data.propertyId,
          token_type: "CIT",
          balance: citReceived,
        }]);
      }

      // Record pool deposit
      await supabase.from("pool_deposits").insert([{
        user_id: data.userId,
        property_id: data.propertyId,
        amount: data.amount,
        cit_received: citReceived,
      }]);

      res.status(200).json({
        success: true,
        message: `Deposited ${data.amount} PT, received ${citReceived} CIT`,
        txHash,
        citReceived,
      });
    } catch (err) {
      console.log("Pool deposit error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  async withdraw(req: Request, res: Response) {
    const { success, data, error } = poolWithdrawSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ success: false, message: error.message, error });
      return;
    }

    try {
      const { data: citBalances } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("token_type", "CIT");

      const totalCit = (citBalances ?? []).reduce((sum: number, b: any) => sum + b.balance, 0);

      if (totalCit < data.citAmount) {
        res.status(400).json({
          success: false,
          error: `Insufficient CIT balance. Available: ${totalCit}`,
        });
        return;
      }

      const txHash = await withdrawFromPool(data.citAmount);

      let remaining = data.citAmount;
      for (const bal of (citBalances ?? [])) {
        if (remaining <= 0) break;
        const deduct = Math.min(bal.balance, remaining);
        const newBal = bal.balance - deduct;
        if (newBal <= 0) {
          await supabase.from("user_token_balances").delete().eq("id", bal.id);
        } else {
          await supabase
            .from("user_token_balances")
            .update({ balance: newBal, updated_at: new Date().toISOString() })
            .eq("id", bal.id);
        }
        remaining -= deduct;
      }

      res.status(200).json({
        success: true,
        message: `Withdrew ${data.citAmount} CIT from pool`,
        txHash,
      });
    } catch (err) {
      console.log("Pool withdraw error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  async claimVcc(req: Request, res: Response) {
    const { success, data, error } = poolClaimSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ success: false, message: error.message, error });
      return;
    }

    try {
      const { data: citBalances } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("token_type", "CIT");

      const totalCit = (citBalances ?? []).reduce((sum: number, b: any) => sum + b.balance, 0);

      if (totalCit < data.citAmount) {
        res.status(400).json({
          success: false,
          error: `Insufficient CIT balance. Available: ${totalCit}`,
        });
        return;
      }

      const txHash = await claimVccFromPool(data.citAmount);

      // Deduct CIT and add VCC proportionally
      let remaining = data.citAmount;
      for (const bal of (citBalances ?? [])) {
        if (remaining <= 0) break;
        const deduct = Math.min(bal.balance, remaining);
        const newBal = bal.balance - deduct;

        if (newBal <= 0) {
          await supabase.from("user_token_balances").delete().eq("id", bal.id);
        } else {
          await supabase
            .from("user_token_balances")
            .update({ balance: newBal, updated_at: new Date().toISOString() })
            .eq("id", bal.id);
        }

        // Add VCC for this property
        const { data: existingVcc } = await supabase
          .from("user_token_balances")
          .select("*")
          .eq("user_id", data.userId)
          .eq("property_id", bal.property_id)
          .eq("token_type", "VCC")
          .single();

        if (existingVcc) {
          await supabase
            .from("user_token_balances")
            .update({
              balance: existingVcc.balance + deduct,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingVcc.id);
        } else {
          await supabase.from("user_token_balances").insert([{
            user_id: data.userId,
            property_id: bal.property_id,
            token_type: "VCC",
            balance: deduct,
          }]);
        }

        remaining -= deduct;
      }

      res.status(200).json({
        success: true,
        message: `Claimed ${data.citAmount} VCC from pool (FCFS)`,
        txHash,
      });
    } catch (err) {
      console.log("Pool claim error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}

export default new PoolController();
