import { Request, Response } from "express";
import offsetCreateSchema from "../schemas/offsetCreate.schema";
import { supabase } from "../lib/supabase";
import { offsetCredits } from "../lib/ethers";
import { CONFIG } from "../lib/config";

class OffsetController {
  async offsetCredits(req: Request, res: Response) {
    const { success, data, error } = offsetCreateSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({
        success: false,
        message: error.message,
        error,
      });

      return;
    }

    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from("owners")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .single();

      const { data: propertyData, error: propertyError } = await supabase
        .from("property_data")
        .select("*")
        .eq("id", data.propertyId)
        .single();

      if (!ownerData || ownerError || !propertyData || propertyError) {
        console.log(ownerError);
        console.log(propertyError);
        res.status(400).json({
          success: false,
          error: "Failed to offset credits - 1",
        });
        return;
      }

      // Check ACC balance instead of raw owner credits
      const { data: accBalance } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", "ACC")
        .single();

      const availableAcc = accBalance?.balance ?? 0;

      if (data.credits > availableAcc) {
        res.status(400).json({
          success: false,
          error: `You don't have enough ACC credits. Available: ${availableAcc}`,
        });
        return;
      }

      // Burn ACC on-chain via CreditManager
      let hash = "";
      try {
        hash = await offsetCredits(CONFIG.companyAddress, data.credits);
      } catch (chainError) {
        console.log(`Offset blockchain error: ${chainError}`);
        res.status(400).json({
          success: false,
          error: "Blockchain transaction failed",
          message: String(chainError),
        });
        return;
      }

      // Update ACC balance in DB
      const newAccBalance = availableAcc - data.credits;
      if (newAccBalance === 0 && accBalance) {
        await supabase
          .from("user_token_balances")
          .delete()
          .eq("id", accBalance.id);
      } else if (accBalance) {
        await supabase
          .from("user_token_balances")
          .update({
            balance: newAccBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", accBalance.id);
      }

      // Update owner credits
      const remainingCredits = ownerData.credits - data.credits;
      if (remainingCredits <= 0) {
        await supabase
          .from("owners")
          .delete()
          .eq("user_id", ownerData.user_id)
          .eq("property_id", ownerData.property_id);
      } else {
        await supabase
          .from("owners")
          .update({ credits: remainingCredits })
          .eq("user_id", ownerData.user_id)
          .eq("property_id", ownerData.property_id);
      }

      // Record offset
      const { data: dbData, error: dbError } = await supabase
        .from("offset")
        .insert([
          {
            user_id: data.userId,
            property_id: data.propertyId,
            credits: data.credits,
            description: data.description,
            transaction_hash: hash,
            beneficiary_address: data.beneficiaryAddress,
            beneficiary_name: data.beneficiaryName,
          },
        ])
        .select()
        .single();

      if (dbData) {
        res.status(200).json({
          success: true,
          message: `Offset ${data.credits} ACC credits successfully`,
          data: {
            ...dbData,
            companyName: propertyData.name,
          },
        });
      } else {
        console.log(dbError);
        res.status(400).json({
          success: false,
          error: "Failed to record offset in database",
        });
      }
    } catch (error) {
      console.log("Failed to offset:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}

export default new OffsetController();
