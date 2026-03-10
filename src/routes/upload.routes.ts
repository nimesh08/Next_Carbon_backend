import { Router } from "express";
import multer from "multer";
import { supabase } from "../lib/supabase";

const uploadRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

uploadRouter.post("/kyc", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }

    const fileName = `kyc/${Date.now()}-${req.file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("kycdocument")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      res.status(400).json({ success: false, error: uploadError.message });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("kycdocument")
      .getPublicUrl(fileName);

    res.json({ success: true, url: publicUrlData.publicUrl });
  } catch (err) {
    console.log("Upload error:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

uploadRouter.post("/project-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }

    const fileName = `images/${Date.now()}-${req.file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("project_images")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      res.status(400).json({ success: false, error: uploadError.message });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("project_images")
      .getPublicUrl(fileName);

    res.json({ success: true, url: publicUrlData.publicUrl });
  } catch (err) {
    console.log("Upload error:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

export default uploadRouter;
