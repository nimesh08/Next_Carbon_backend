import { z } from "zod";

const orderVerifySchema = z.object({
  orderId: z.string({
    message: "Order id must be a valid string",
  }),
  userId: z.string({
    message: "User id must be a valid string",
  }),
  propertyId: z.string({
    message: "Property id must be a valid string",
  }),
  shares: z.number({
    message: "Number of shares must be a valid integer",
  }),
  paymentId: z.string({
    message: "Payment id must be a valid string",
  }),
  razorpaySignature: z.string({
    message: "Razorpay signature must be a valid string",
  }),
});

export default orderVerifySchema;
