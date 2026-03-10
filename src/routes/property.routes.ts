import { Router } from "express";
import propertyController from "../controllers/property.controller";

const propertyRouter = Router();

propertyRouter
  .route("/")
  .get(propertyController.getAllProperties)
  .post(propertyController.createProperty)
  .delete(propertyController.deleteProperty);

propertyRouter.route("/:propertyId").get(propertyController.getPropetyById);

export default propertyRouter;
