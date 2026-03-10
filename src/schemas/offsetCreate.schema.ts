import { z } from "zod";

const offsetCreateSchema = z.object({
  userId: z.string({
    message: "Please provide a valid user id",
  }),
  propertyId: z.string({
    message: "Please provide a valid property id",
  }),
  credits: z.number({
    message: "Number of credits must be a valid integer",
  }),
  description: z.string({
    message: "Order currency must be a valid string",
  }),
  beneficiaryAddress: z.string({
    message: "Beneficiary address must be a valid string",
  }),
  beneficiaryName: z.string({
    message: "Beneficiary name must be a valid string",
  }),
});

export default offsetCreateSchema;
