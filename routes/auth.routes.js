import { Router } from "express";
import {
  confirmSignUp,
  login,
  refresh,
  signUp,
} from "../controller/auth.controller.js";

export const authRouter = Router();

authRouter.route("/signup").post(signUp);
authRouter.route("/confirm").post(confirmSignUp);
authRouter.route("/login").post(login);
authRouter.route("/refresh").post(refresh);
