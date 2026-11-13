import { CognitoJwtVerifier } from "aws-jwt-verify";
import "dotenv/config";
import { pool } from "../config/database.js";
import { provisionUser } from "../services/user.service.js";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID,
});

const unauthorized = (res) =>
  res.status(401).json({ message: "Unauthorized" });

export const authenticate = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");

  if (scheme !== "Bearer" || !token) return unauthorized(res);

  // Token problems are the client's fault: always 401.
  let payload;
  try {
    payload = await verifier.verify(token);
  } catch {
    return unauthorized(res); // expired, wrong pool, bad signature, etc.
  }

  // Anything failing past this point is a server problem: let errorMiddleware handle it.
  try {
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE cognito_id = $1",
      [payload.sub],
    );

    // Confirmed in Cognito but no local row yet (e.g. the insert during
    // confirmSignUp failed): create it now so the user isn't locked out.
    const userId = rows[0]?.id ?? (await provisionUser(payload.username));

    req.user = {
      id: userId,
      cognitoId: payload.sub,
      groups: payload["cognito:groups"] ?? [],
    };

    next();
  } catch (error) {
    next(error);
  }
};
