import { z } from "zod";

const orderCreateSchema = z.object({
  userId: z.string({
    message: "Please provide a valid user id",
  }),
  propertyId: z.string({
    message: "Please provide a valid property id",
  }),
  shares: z.number({
    message: "Number of shares must be a valid integer",
  }),
  currency: z
    .string({
      message: "Order currency must be a valid string",
    })
    .default("INR")
    .optional(),
});

export default orderCreateSchema;
