import { Router } from "express";
import {
  getFoodImageUploadUrl,
  insertFood,
} from "../controller/food.controller.js";

export const foodRouter = Router();

foodRouter.route("/upload-url").post(getFoodImageUploadUrl);
foodRouter.route("/add").post(insertFood);
