import Razorpay from "razorpay";
import { CONFIG } from "./config";

const razorpay = new Razorpay({
  key_id: CONFIG.razorpayKeyId,
  key_secret: CONFIG.razorpaySecret,
});

export default razorpay;
