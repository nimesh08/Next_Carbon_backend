import { Router } from "express";
import { supabase } from "../lib/supabase";

const kycRouter = Router();

kycRouter.post("/submit", async (req, res) => {
  try {
    const { user_id, fullName, phoneNumber, username, documentType, documentNumber, documentImage } = req.body;

    if (!user_id || !fullName || !documentType || !documentNumber) {
      res.status(400).json({ success: false, error: "Missing required fields" });
      return;
    }

    const { error } = await supabase.from("user_kyc").insert([{
      user_id,
      fullName,
      phoneNumber,
      username,
      documentType,
      documentNumber,
      documentImage,
      status: false,
    }]);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: "KYC submitted successfully" });
  } catch (err) {
    console.log("KYC submit error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default kycRouter;
