import crypto from "crypto";
import { Request, Response } from "express";
import razorpay from "../lib/razorpay";
import orderCreateSchema from "../schemas/orderCreate.schema";
import orderVerifySchema from "../schemas/orderVerify.schema";
import { supabase } from "../lib/supabase";
import { mintProjectTokens, getTokenSupplyInfo } from "../lib/ethers";
import { CONFIG } from "../lib/config";

class OrderController {
  async getOrderById(req: Request, res: Response) {
    const orderId = req.params.orderId;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid order id",
      });

      return;
    }

    res.status(200).json({
      success: true,
    });
  }

  async createOrder(req: Request, res: Response) {
    const { success, data, error } = orderCreateSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        success: false,
        message: error.message,
        error,
      });

      return;
    }

    const orderReceipt = `rcpt_${crypto
      .randomBytes(3)
      .toString("hex")}_${Date.now()}`;

    try {
      const { data: propertyData } = await supabase
        .from("property_data")
        .select("*")
        .eq("id", data.propertyId)
        .single();

      if (!propertyData) {
        res.status(400).json({
          success: false,
          error: "Property could not be found",
        });

        return;
      }

      if (propertyData.available_shares < data.shares) {
        res.status(400).json({
          success: false,
          error: `Invalid request: Only ${propertyData.available_shares} shares are available. You can't place an order for ${data.shares} shares.`,
        });

        return;
      }

      if (propertyData.token_address) {
        const { totalSupply, maxSupply } = await getTokenSupplyInfo(propertyData.token_address);
        if (totalSupply + data.shares > maxSupply) {
          res.status(400).json({
            success: false,
            error: `Sold out: only ${Math.floor(maxSupply - totalSupply)} shares remain mintable on-chain.`,
          });
          return;
        }
      }

      const order = await razorpay.orders.create({
        amount: Math.round(propertyData.price * data.shares * 100),
        currency: data.currency ?? "INR",
        receipt: orderReceipt,
      });

      const { data: dbData, error: dbError } = await supabase
        .from("payments")
        .insert([
          {
            user_id: data.userId,
            property_id: data.propertyId,
            amount: Number(order.amount) / 100,
            currency: order.currency,
            order_id: order.id,
            receipt_id: order.receipt,
            offer_id: order.offer_id,
            status: "created",
            shares: data.shares,
          },
        ])
        .select();

      if (order && dbData) {
        res.status(200).json({
          success: true,
          message: "Order created successfully",
          data: order,
        });
      } else {
        console.log(dbError);
        console.log(error);

        res.status(400).json({
          success: false,
          error: "Failed to create the order",
        });

        return;
      }
    } catch (error) {
      console.log("Failed to create order:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  async verifyOrder(req: Request, res: Response) {
    const { data, success, error } = orderVerifySchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({
        success: false,
        message: error.message,
        error,
      });

      return;
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET as string)
      .update(data.orderId + "|" + data.paymentId)
      .digest("hex");

    if (data.razorpaySignature === expectedSignature) {
      const { data: paymentData } = await supabase
        .from("payments")
        .update({
          status: "success",
        })
        .eq("order_id", data.orderId)
        .select()
        .single();

      const { data: propertyData } = await supabase
        .from("property_data")
        .select("*")
        .eq("id", data.propertyId)
        .single();

      if (!propertyData) {
        res.status(400).json({
          success: false,
          error: "Invalid property id provided",
        });

        return;
      }

      if (propertyData.available_shares < data.shares) {
        res.status(400).json({
          success: false,
          error: `Payment was successful but ${data.shares} shares are not left. Maybe someone already bought it.`,
        });

        return;
      }

      await supabase
        .from("property_data")
        .update({
          available_shares: propertyData.available_shares - data.shares,
        })
        .eq("id", data.propertyId);

      const { data: ownerData } = await supabase
        .from("owners")
        .select("*")
        .eq("user_id", data.userId)
        .eq("property_id", data.propertyId)
        .single();

      if (ownerData) {
        await supabase
          .from("owners")
          .update({
            credits: ownerData.credits + data.shares,
          })
          .eq("user_id", data.userId)
          .eq("property_id", data.propertyId);
      } else {
        await supabase.from("owners").insert([
          {
            user_id: data.userId,
            property_id: data.propertyId,
            credits: data.shares,
          },
        ]);
      }

      // Mint PT on-chain to company wallet
      let tokenTxHash = "";
      try {
        if (propertyData.token_address) {
          const { totalSupply, maxSupply } = await getTokenSupplyInfo(propertyData.token_address);
          if (totalSupply + data.shares > maxSupply) {
            res.status(400).json({
              success: false,
              error: `On-chain mint would exceed max supply (${maxSupply}). Only ${Math.floor(maxSupply - totalSupply)} mintable.`,
            });
            return;
          }

          tokenTxHash = await mintProjectTokens(
            propertyData.token_address,
            CONFIG.companyAddress,
            data.shares
          );

          await supabase
            .from("payments")
            .update({ token_tx_hash: tokenTxHash })
            .eq("order_id", data.orderId);

          const { data: existingBalance } = await supabase
            .from("user_token_balances")
            .select("*")
            .eq("user_id", data.userId)
            .eq("property_id", data.propertyId)
            .eq("token_type", "PT")
            .single();

          if (existingBalance) {
            await supabase
              .from("user_token_balances")
              .update({
                balance: existingBalance.balance + data.shares,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingBalance.id);
          } else {
            await supabase.from("user_token_balances").insert([
              {
                user_id: data.userId,
                property_id: data.propertyId,
                token_type: "PT",
                balance: data.shares,
              },
            ]);
          }
        }
      } catch (mintError) {
        console.log("On-chain PT mint failed:", mintError);
        res.status(500).json({
          success: false,
          error: "Payment verified but on-chain token minting failed. Contact support.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Payment successful, ${data.shares} bought successfully`,
        tokenTxHash,
      });
    } else {
      await supabase
        .from("payments")
        .update({
          status: "failed",
        })
        .eq("order_id", data.orderId);

      res.status(400).json({
        success: false,
        message: "Payment is not verified",
      });
    }
  }
}

export default new OrderController();
