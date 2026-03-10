import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import {
  depositToPool,
  withdrawFromPool,
  claimActualCreditsFromPool,
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
      // Check RTP balance
      const { data: rtpBalance } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", "RTP")
        .single();

      if (!rtpBalance || rtpBalance.balance < data.amount) {
        res.status(400).json({
          success: false,
          error: `Insufficient RTP balance. Available: ${rtpBalance?.balance ?? 0}`,
        });
        return;
      }

      const { data: propertyData } = await supabase
        .from("property_data")
        .select("token_address, weight")
        .eq("id", data.propertyId)
        .single();

      if (!propertyData?.token_address) {
        res.status(400).json({ success: false, error: "Property has no token" });
        return;
      }

      const txHash = await depositToPool(propertyData.token_address, data.amount);

      const secReceived = data.amount * (propertyData.weight ?? 1);

      // Deduct RTP
      const newRtp = rtpBalance.balance - data.amount;
      if (newRtp <= 0) {
        await supabase.from("user_token_balances").delete().eq("id", rtpBalance.id);
      } else {
        await supabase
          .from("user_token_balances")
          .update({ balance: newRtp, updated_at: new Date().toISOString() })
          .eq("id", rtpBalance.id);
      }

      // Add SEC balance
      const { data: existingSec } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", "SEC")
        .single();

      if (existingSec) {
        await supabase
          .from("user_token_balances")
          .update({
            balance: existingSec.balance + secReceived,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSec.id);
      } else {
        await supabase.from("user_token_balances").insert([
          {
            user_id: data.userId,
            property_id: data.propertyId,
            token_type: "SEC",
            balance: secReceived,
          },
        ]);
      }

      // Record pool deposit
      await supabase.from("pool_deposits").insert([
        {
          user_id: data.userId,
          property_id: data.propertyId,
          amount: data.amount,
          sec_received: secReceived,
        },
      ]);

      res.status(200).json({
        success: true,
        message: `Deposited ${data.amount} RTP, received ${secReceived} SEC`,
        txHash,
        secReceived,
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
      // Get all SEC balances for user
      const { data: secBalances } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("token_type", "SEC");

      const totalSec = (secBalances ?? []).reduce((sum, b) => sum + b.balance, 0);

      if (totalSec < data.secAmount) {
        res.status(400).json({
          success: false,
          error: `Insufficient SEC balance. Available: ${totalSec}`,
        });
        return;
      }

      const txHash = await withdrawFromPool(data.secAmount);

      // Proportionally deduct SEC across projects
      let remaining = data.secAmount;
      for (const bal of (secBalances ?? [])) {
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
        message: `Withdrew ${data.secAmount} SEC from pool`,
        txHash,
      });
    } catch (err) {
      console.log("Pool withdraw error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  async claimAcc(req: Request, res: Response) {
    const { success, data, error } = poolClaimSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ success: false, message: error.message, error });
      return;
    }

    try {
      const { data: secBalances } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("token_type", "SEC");

      const totalSec = (secBalances ?? []).reduce((sum, b) => sum + b.balance, 0);

      if (totalSec < data.secAmount) {
        res.status(400).json({
          success: false,
          error: `Insufficient SEC balance. Available: ${totalSec}`,
        });
        return;
      }

      const txHash = await claimActualCreditsFromPool(data.secAmount);

      // Deduct SEC, add ACC proportionally
      let remaining = data.secAmount;
      for (const bal of (secBalances ?? [])) {
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

        // Add ACC for this property
        const { data: existingAcc } = await supabase
          .from("user_token_balances")
          .select("*")
          .eq("user_id", data.userId)
          .eq("property_id", bal.property_id)
          .eq("token_type", "ACC")
          .single();

        if (existingAcc) {
          await supabase
            .from("user_token_balances")
            .update({
              balance: existingAcc.balance + deduct,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAcc.id);
        } else {
          await supabase.from("user_token_balances").insert([
            {
              user_id: data.userId,
              property_id: bal.property_id,
              token_type: "ACC",
              balance: deduct,
            },
          ]);
        }

        remaining -= deduct;
      }

      res.status(200).json({
        success: true,
        message: `Claimed ${data.secAmount} ACC from pool`,
        txHash,
      });
    } catch (err) {
      console.log("Pool claim error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}

export default new PoolController();
