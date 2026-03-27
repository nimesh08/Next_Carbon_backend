import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { partialMatureProject } from "../lib/ethers";

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

      const { data: ptHolders } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("property_id", propertyId)
        .eq("token_type", "PT");

      let totalConverted = 0;
      for (const holder of (ptHolders ?? [])) {
        const convertAmount = (holder.balance * actualPercent) / (100 - currentMaturity);
        if (convertAmount > 0) totalConverted += convertAmount;
      }

      const txHash = await partialMatureProject(propertyId, actualPercent);
      console.log("ON-CHAIN: partialMature tx:", txHash);

      let totalVccMinted = 0;
      for (const holder of (ptHolders ?? [])) {
        const convertAmount = (holder.balance * actualPercent) / (100 - currentMaturity);
        if (convertAmount <= 0) continue;
        totalVccMinted += convertAmount;

        const newPt = holder.balance - convertAmount;
        if (newPt <= 0.001) {
          await supabase.from("user_token_balances").delete().eq("id", holder.id);
        } else {
          await supabase
            .from("user_token_balances")
            .update({ balance: newPt, updated_at: new Date().toISOString() })
            .eq("id", holder.id);
        }

        const { data: existingVcc } = await supabase
          .from("user_token_balances")
          .select("*")
          .eq("user_id", holder.user_id)
          .eq("property_id", propertyId)
          .eq("token_type", "VCC")
          .single();

        if (existingVcc) {
          await supabase
            .from("user_token_balances")
            .update({
              balance: existingVcc.balance + convertAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingVcc.id);
        } else {
          await supabase.from("user_token_balances").insert([{
            user_id: holder.user_id,
            property_id: propertyId,
            token_type: "VCC",
            balance: convertAmount,
          }]);
        }
      }

      await supabase
        .from("property_data")
        .update({ maturity_percentage: newMaturity, is_mature: newMaturity >= 100 })
        .eq("id", propertyId);

      const { data: existingAr } = await supabase
        .from("available_retirements")
        .select("*")
        .eq("property_id", propertyId)
        .single();

      if (existingAr) {
        await supabase
          .from("available_retirements")
          .update({
            available: existingAr.available + totalVccMinted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAr.id);
      } else {
        await supabase.from("available_retirements").insert([{
          property_id: propertyId,
          available: totalVccMinted,
        }]);
      }

      await supabase.from("maturity_events").insert([{
        property_id: propertyId,
        percentage: actualPercent,
        total_pt_burned: totalConverted,
        total_vcc_minted: totalVccMinted,
        tx_hash: txHash,
      }]);

      res.status(200).json({
        success: true,
        message: `Matured ${actualPercent.toFixed(1)}%. Total: ${newMaturity.toFixed(1)}%. ${totalConverted.toFixed(2)} PT burned, ${totalVccMinted.toFixed(2)} VCC minted.`,
        txHash,
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

  async getAvailableRetirements(_req: Request, res: Response) {
    const { data, error } = await supabase
      .from("available_retirements")
      .select("*, property_data(name, image, type)")
      .gt("available", 0);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    res.json({ success: true, data });
  }
}

export default new AdminController();
