import { Router } from "express";
import poolController from "../controllers/pool.controller";

const poolRouter = Router();

poolRouter.route("/deposit").post(poolController.deposit);
poolRouter.route("/withdraw").post(poolController.withdraw);
poolRouter.route("/claim").post(poolController.claimVcc);

export default poolRouter;
