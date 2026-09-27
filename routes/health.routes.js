import { Router } from "express";
import { getHealthStatus } from "../controller/health.controller.js";

export const healthRouter = Router();

healthRouter.route("/status").get(getHealthStatus);
