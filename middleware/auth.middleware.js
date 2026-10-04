import { CognitoJwtVerifier } from "aws-jwt-verify";
import "dotenv/config";
import { pool } from "../config/database.js";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID,
});

export const verifyToken = async (token) => {
  try {
    const payload = await verifier.verify(token);

    return payload;
  } catch (error) {
    console.error("Token verification failed:", error.name);
  }
};

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];

    const payload = await verifyToken(token);

    const user = await pool.query(
      `
      SELECT id FROM users
      WHERE cognito_id=$1
      `,
      [payload.sub],
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
      id: user.rows[0].id,
      cognitoId: payload.sub,
      role: payload["cognito:groups"] || [],
    };

    next();
  } catch (error) {
    if (error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.error("Error:", error.name);

    return res.status(500).json({ message: "Internal server error" });
  }
};
