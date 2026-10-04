import { Router } from "express";
import {
  getAllFoods,
  getFoodImageUploadUrl,
  insertFood,
} from "../controller/food.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authenticateAdmin } from "../middleware/admin.middleware.js";

export const foodRouter = Router();

foodRouter.route("/upload-url").post(authenticate, getFoodImageUploadUrl);
foodRouter.route("/add").post(authenticate, authenticateAdmin, insertFood);
foodRouter.route("/all").get(getAllFoods);
