import { Request, Response } from "express";
import offsetCreateSchema from "../schemas/offsetCreate.schema";
import { supabase } from "../lib/supabase";
import { offsetWithCertificate } from "../lib/ethers";
import { CONFIG } from "../lib/config";

class OffsetController {
  async offsetCredits(req: Request, res: Response) {
    const { success, data, error } = offsetCreateSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ success: false, message: error.message, error });
      return;
    }

    try {
      const { data: propertyData } = await supabase
        .from("property_data")
        .select("*")
        .eq("id", data.propertyId)
        .single();

      if (!propertyData) {
        res.status(400).json({ success: false, error: "Property not found" });
        return;
      }

      const { data: vccBalance } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .eq("token_type", "VCC")
        .single();

      const availableVcc = vccBalance?.balance ?? 0;

      if (data.credits > availableVcc) {
        res.status(400).json({
          success: false,
          error: "Insufficient VCC balance. Available: " + availableVcc,
        });
        return;
      }

      const { data: retirementData } = await supabase
        .from("available_retirements")
        .select("*")
        .eq("property_id", data.propertyId)
        .single();

      const retirementAvailable = retirementData?.available ?? 0;
      if (data.credits > retirementAvailable) {
        res.status(400).json({
          success: false,
          error: "Only " + retirementAvailable + " VCC available for retirement on this project",
        });
        return;
      }

      const certURI = "https://carbon-certs.example.com/" + data.propertyId + "/" + Date.now();
      const { txHash } = await offsetWithCertificate(
        CONFIG.companyAddress,
        data.credits,
        data.propertyId,
        certURI
      );

      const newVccBalance = availableVcc - data.credits;
      if (newVccBalance <= 0 && vccBalance) {
        await supabase.from("user_token_balances").delete().eq("id", vccBalance.id);
      } else if (vccBalance) {
        await supabase
          .from("user_token_balances")
          .update({ balance: newVccBalance, updated_at: new Date().toISOString() })
          .eq("id", vccBalance.id);
      }

      if (retirementData) {
        const newAvailable = retirementAvailable - data.credits;
        await supabase
          .from("available_retirements")
          .update({ available: Math.max(0, newAvailable), updated_at: new Date().toISOString() })
          .eq("id", retirementData.id);
      }

      await supabase.from("retirement_certificates").insert([{
        user_id: data.userId,
        property_id: data.propertyId,
        amount: data.credits,
        tx_hash: txHash,
        certificate_uri: certURI,
      }]);

      const { data: dbData, error: dbError } = await supabase
        .from("offset")
        .insert([{
          user_id: data.userId,
          property_id: data.propertyId,
          credits: data.credits,
          description: data.description,
          transaction_hash: txHash,
          beneficiary_address: data.beneficiaryAddress,
          beneficiary_name: data.beneficiaryName,
        }])
        .select()
        .single();

      if (dbData) {
        res.status(200).json({
          success: true,
          message: "Offset " + data.credits + " VCC credits. NFT certificate minted.",
          data: { ...dbData, companyName: propertyData.name },
          txHash,
          certificateUri: certURI,
        });
      } else {
        console.log(dbError);
        res.status(400).json({ success: false, error: "Failed to record offset" });
      }
    } catch (error) {
      console.log("Failed to offset:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  async getCertificates(req: Request, res: Response) {
    const userId = req.params.userId;
    const { data, error } = await supabase
      .from("retirement_certificates")
      .select("*, property_data(name, image, type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    res.json({ success: true, data });
  }
}

export default new OffsetController();
