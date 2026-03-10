import { Router } from "express";
import offsetController from "../controllers/offset.controller";

const offsetRouter = Router();

offsetRouter.route("/").post(offsetController.offsetCredits);

export default offsetRouter;
