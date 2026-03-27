import type { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import {
  deletePropertySchema,
  propertyCreateSchema,
} from "../schemas/property.schema";
import { createProjectToken, registerProject, setProjectTokenManager } from "../lib/ethers";
import { CONFIG } from "../lib/config";

class PropertyController {
  async getAllProperties(_req: Request, res: Response) {
    const { data, error } = await supabase
      .from("property_data")
      .select("*");

    if (!data) {
      res.status(400).json({
        success: false,
        error,
      });

      return;
    }

    res.json({
      success: true,
      data,
    });
  }

  async getPropetyById(req: Request, res: Response) {
    const propertyId = req.params.propertyId;

    const { data, error } = await supabase
      .from("property_data")
      .select("*")
      .eq("id", propertyId);

    if (!data || error) {
      res.status(400).json({
        success: false,
        error: "No property found with that id",
      });

      return;
    }

    res.json({
      success: true,
      data,
    });
  }

  async createProperty(req: Request, res: Response) {
    const { success, data, error } = propertyCreateSchema.safeParse(req.body);

    if (!success) {
      res.json({
        success: false,
        error,
      });

      return;
    }

    const { data: dbData } = await supabase
      .from("property_data")
      .insert([
        {
          name: data?.name,
          status: data?.status,
          price: data?.price,
          available_shares: data?.availableShares,
          totalShares: data?.availableShares,
          location: data?.location,
          type: data?.type,
          image: data?.image,
          attributes: data?.attributes,
          value_parameters: data?.valueParameters,
          updates: data?.updates,
          growth: data?.growth,
          description: data?.description,
          weight: data?.weight ?? 1,
        },
      ])
      .select()
      .single();

    if (!dbData) {
      res.json({ success: false, error: "Failed to insert property" });
      return;
    }

    // Deploy a ProjectToken ERC-20 for this property
    let tokenAddress = "";
    try {
      const symbol = (data?.name ?? "TOKEN")
        .replace(/[^A-Za-z]/g, "")
        .substring(0, 5)
        .toUpperCase();

      const maxSupply = data?.availableShares ?? 10000;
      const result = await createProjectToken(
        dbData.id,
        `${data?.name} Carbon Credit`,
        symbol,
        maxSupply
      );
      tokenAddress = result.tokenAddress;

      await supabase
        .from("property_data")
        .update({ token_address: tokenAddress })
        .eq("id", dbData.id);

      await setProjectTokenManager(tokenAddress, CONFIG.creditManagerAddress);
      await registerProject(dbData.id);
    } catch (tokenError) {
      console.log("Token deployment failed (property still created):", tokenError);
    }

    res.json({
      success: true,
      message: "Created new property with token.",
      data: { ...dbData, token_address: tokenAddress },
    });
  }

  async deleteProperty(req: Request, res: Response) {
    const { success, data, error } = deletePropertySchema.safeParse(req.body);

    if (!success) {
      res.json({
        success: false,
        error,
      });

      return;
    }

    const { data: dbData, error: dbError } = await supabase
      .from("property_data")
      .delete()
      .eq("id", data.id)
      .select();

    if (!data) {
      res.json({
        success: false,
        error: dbError,
      });

      return;
    }

    res.json({
      success: true,
      data: dbData,
    });
  }
}

export default new PropertyController();
