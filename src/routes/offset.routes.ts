import { Router } from "express";
import offsetController from "../controllers/offset.controller";

const offsetRouter = Router();

offsetRouter.route("/").post(offsetController.offsetCredits);
offsetRouter.route("/certificates/:userId").get(offsetController.getCertificates);

export default offsetRouter;
