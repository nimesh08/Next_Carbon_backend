import { Router } from "express";
import adminController from "../controllers/admin.controller";

const adminRouter = Router();

adminRouter.route("/mature/:projectId").post(adminController.matureProject);
adminRouter.route("/maturity-history/:projectId").get(adminController.getMaturityHistory);
adminRouter.route("/projects-maturity").get(adminController.getAllProjectsMaturity);
adminRouter.route("/available-retirements").get(adminController.getAvailableRetirements);

export default adminRouter;
