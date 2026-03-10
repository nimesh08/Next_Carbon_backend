import cors from "cors";
import express from "express";
import { CONFIG } from "./lib/config";
import orderRouter from "./routes/order.routes";
import propertyRouter from "./routes/property.routes";
import offsetRouter from "./routes/offset.routes";
import tokenRouter from "./routes/token.routes";
import poolRouter from "./routes/pool.routes";
import adminRouter from "./routes/admin.routes";
import uploadRouter from "./routes/upload.routes";
import kycRouter from "./routes/kyc.routes";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (_req, res) => {
  res.json({
    message: "Hello from Next Carbon!",
  });
});

app.use("/api/orders", orderRouter);
app.use("/api/property", propertyRouter);
app.use("/api/offset", offsetRouter);
app.use("/api/tokens", tokenRouter);
app.use("/api/pool", poolRouter);
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/kyc", kycRouter);

app.listen(Number(CONFIG.port), "0.0.0.0", () => {
  console.log(`Server online: http://0.0.0.0:${CONFIG.port}`);
});
