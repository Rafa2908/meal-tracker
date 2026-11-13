import express from "express";
import { rateLimit } from "express-rate-limit";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { foodRouter } from "./routes/food.routes.js";
import { myFoodRouter } from "./routes/myFoods.routes.js";

export const app = express();

// Elastic Beanstalk puts nginx (or a load balancer) in front of the app;
// without this, every request appears to come from the proxy's IP.
app.set("trust proxy", 1);

// Passwords and six-digit codes are guessable without a limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // requests per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/users", userRouter);
app.use("/api/foods", foodRouter);
app.use("/api/myfoods", myFoodRouter);
app.use(errorMiddleware);
