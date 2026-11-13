import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getAllMyFoods,
  getMyFoodById,
  getMyFoodImageUploadUrl,
  insertMyFood,
} from "../controller/myFood.controller.js";

export const myFoodRouter = Router();

myFoodRouter.route("/upload-url").post(authenticate, getMyFoodImageUploadUrl);
myFoodRouter.route("/add").post(authenticate, insertMyFood);
myFoodRouter.route("/all").get(authenticate, getAllMyFoods);
myFoodRouter.route("/:foodId").get(authenticate, getMyFoodById);
