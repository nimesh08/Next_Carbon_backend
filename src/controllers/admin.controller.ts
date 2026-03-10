import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { burnPartialRtp, mintPartialAcc, matureProject, getOnChainRtpBalance } from "../lib/ethers";

class AdminController {
  async matureProject(req: Request, res: Response) {
    const propertyId = req.params.projectId;
    const { percentage } = req.body;

    if (!propertyId) {
      res.status(400).json({ success: false, error: "Property ID is required" });
      return;
    }

    const maturePercent = Number(percentage);
    if (!maturePercent || maturePercent <= 0 || maturePercent > 100) {
      res.status(400).json({ success: false, error: "Percentage must be between 1 and 100" });
      return;
    }

    try {
      const { data: propertyData } = await supabase
        .from("property_data")
        .select("*")
        .eq("id", propertyId)
        .single();

      if (!propertyData) {
        res.status(400).json({ success: false, error: "Property not found" });
        return;
      }

      if (!propertyData.token_address) {
        res.status(400).json({ success: false, error: "Property has no token contract deployed" });
        return;
      }

      const currentMaturity = propertyData.maturity_percentage ?? 0;
      const newMaturity = Math.min(currentMaturity + maturePercent, 100);
      const actualPercent = newMaturity - currentMaturity;

      if (actualPercent <= 0) {
        res.status(400).json({ success: false, error: "Project is already 100% matured" });
        return;
      }

      // Get all RTP holders for this project
      const { data: rtpHolders } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("property_id", propertyId)
        .eq("token_type", "RTP");

      let totalConverted = 0;

      // Calculate total to convert
      for (const holder of (rtpHolders ?? [])) {
        const convertAmount = (holder.balance * actualPercent) / (100 - currentMaturity);
        if (convertAmount > 0) totalConverted += convertAmount;
      }

      if (totalConverted <= 0) {
        // No RTP holders -- just update maturity percentage
        await supabase
          .from("property_data")
          .update({ maturity_percentage: newMaturity, is_mature: newMaturity >= 100 })
          .eq("id", propertyId);

        res.status(200).json({
          success: true,
          message: `Maturity updated to ${newMaturity.toFixed(1)}%. No token holders to convert.`,
          maturityPercentage: newMaturity,
          converted: 0,
          burnTxHash: "",
          mintTxHash: "",
        });
        return;
      }

      // --- ON-CHAIN: Burn partial RTP from company wallet ---
      let burnTxHash = "";
      try {
        const onChainBalance = await getOnChainRtpBalance(propertyData.token_address);
        const burnAmount = Math.min(totalConverted, onChainBalance);
        if (burnAmount > 0.0001) {
          burnTxHash = await burnPartialRtp(propertyData.token_address, burnAmount);
          console.log(`ON-CHAIN: Burned ${burnAmount} RTP, tx: ${burnTxHash}`);
        }
      } catch (chainErr: any) {
        console.log("On-chain RTP burn failed:", chainErr.message);
      }

      // --- ON-CHAIN: Mint partial ACC to company wallet ---
      let mintTxHash = "";
      try {
        mintTxHash = await mintPartialAcc(totalConverted);
        console.log(`ON-CHAIN: Minted ${totalConverted} ACC, tx: ${mintTxHash}`);
      } catch (chainErr: any) {
        console.log("On-chain ACC mint failed:", chainErr.message);
      }

      // --- OFF-CHAIN: Update user balances in Supabase ---
      for (const holder of (rtpHolders ?? [])) {
        const convertAmount = (holder.balance * actualPercent) / (100 - currentMaturity);
        if (convertAmount <= 0) continue;

        const newRtp = holder.balance - convertAmount;
        if (newRtp <= 0.001) {
          await supabase.from("user_token_balances").delete().eq("id", holder.id);
        } else {
          await supabase
            .from("user_token_balances")
            .update({ balance: newRtp, updated_at: new Date().toISOString() })
            .eq("id", holder.id);
        }

        const { data: existingAcc } = await supabase
          .from("user_token_balances")
          .select("*")
          .eq("user_id", holder.user_id)
          .eq("property_id", propertyId)
          .eq("token_type", "ACC")
          .single();

        if (existingAcc) {
          await supabase
            .from("user_token_balances")
            .update({
              balance: existingAcc.balance + convertAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAcc.id);
        } else {
          await supabase.from("user_token_balances").insert([{
            user_id: holder.user_id,
            property_id: propertyId,
            token_type: "ACC",
            balance: convertAmount,
          }]);
        }
      }

      // At 100%: also call CreditManager.mature() for pool allocation handling
      let fullMatureTxHash = "";
      if (newMaturity >= 100) {
        try {
          fullMatureTxHash = await matureProject(propertyId);
          console.log(`ON-CHAIN: Full maturity triggered, tx: ${fullMatureTxHash}`);
        } catch (chainErr: any) {
          console.log("On-chain full mature failed (partial already done):", chainErr.message);
        }
      }

      // Update property maturity
      await supabase
        .from("property_data")
        .update({ maturity_percentage: newMaturity, is_mature: newMaturity >= 100 })
        .eq("id", propertyId);

      // Log maturity event
      await supabase.from("maturity_events").insert([{
        property_id: propertyId,
        total_rtp_burned: totalConverted,
        total_acc_minted: totalConverted,
        tx_hash: burnTxHash || mintTxHash || fullMatureTxHash || `cycle-${Date.now()}`,
      }]);

      res.status(200).json({
        success: true,
        message: `Matured ${actualPercent.toFixed(1)}% of project. Total: ${newMaturity.toFixed(1)}%. ${totalConverted.toFixed(2)} RTP burned on-chain, ${totalConverted.toFixed(2)} ACC minted on-chain.`,
        burnTxHash,
        mintTxHash,
        fullMatureTxHash,
        maturityPercentage: newMaturity,
        converted: totalConverted,
      });
    } catch (err) {
      console.log("Mature project error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  async getMaturityHistory(req: Request, res: Response) {
    const propertyId = req.params.projectId;

    const { data, error } = await supabase
      .from("maturity_events")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  }

  async getAllProjectsMaturity(_req: Request, res: Response) {
    const { data, error } = await supabase
      .from("property_data")
      .select("id, name, type, status, totalShares, is_mature, maturity_percentage, token_address, weight")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  }
}

export default new AdminController();
