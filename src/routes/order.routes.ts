import { Router } from "express";
import orderController from "../controllers/order.controller";

const orderRouter = Router();

orderRouter.route("/:orderId").get(orderController.getOrderById);
orderRouter.route("/create").post(orderController.createOrder);
orderRouter.route("/verify").post(orderController.verifyOrder);

export default orderRouter;
