import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase";

export const verifySignature = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers.signature;
    const { access_key } = req.body;

    if (!signature || !access_key) {
      res.status(400).json({
        success: false,
        error:
          "Invalid Request: Please provide the access key and signature along with the request",
      });
      return;
    }
    const { data, error } = await supabase
      .from("api_keys")
      .select("secret_key")
      .eq("access_key", access_key)
      .single();

    if (error || !data) {
      res.status(400).json({
        success: false,
        error: "Invalid api keys provided.",
      });
      return;
    }
    const expectedSignature = crypto
      .createHmac("sha256", data?.secret_key)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (expectedSignature !== signature) {
      res.status(400).json({
        success: false,
        error: "Signature Invalid",
      });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
    console.log(err);
  }
};
