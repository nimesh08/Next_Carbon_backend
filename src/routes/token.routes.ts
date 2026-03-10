import { Router } from "express";
import tokenController from "../controllers/token.controller";

const tokenRouter = Router();

tokenRouter.route("/redeem").post(tokenController.redeemTokens);
tokenRouter.route("/balances/:userId").get(tokenController.getBalances);

export default tokenRouter;
