import { Router } from "express";
import {
  deleteFoodById,
  getAllFoods,
  getFoodById,
  getFoodImageUploadUrl,
  insertFood,
  updateFoodById,
} from "../controller/food.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authenticateAdmin } from "../middleware/admin.middleware.js";

export const foodRouter = Router();

foodRouter.route("/upload-url").post(authenticate, getFoodImageUploadUrl);
foodRouter.route("/add").post(authenticate, authenticateAdmin, insertFood);
foodRouter.route("/all").get(getAllFoods);
foodRouter.route("/:foodId").get(getFoodById);
foodRouter
  .route("/update/:foodId")
  .patch(authenticate, authenticateAdmin, updateFoodById);
foodRouter
  .route("/delete/:foodId")
  .delete(authenticate, authenticateAdmin, deleteFoodById);
