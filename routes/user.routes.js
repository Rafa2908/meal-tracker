import { Router } from "express";
import { getMe } from "../controller/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const userRouter = Router();

userRouter.route("/me").get(authenticate, getMe);
