import { AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "../config/cognito.js";
import { pool } from "../config/database.js";

// Reads the user from Cognito and upserts the local row.
// Safe to call any number of times for the same user.
export const provisionUser = async (username) => {
  const info = await cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: username,
    }),
  );

  const attr = (name) =>
    info.UserAttributes.find((a) => a.Name === name)?.Value;

  // DO UPDATE (not DO NOTHING) so RETURNING id always yields a row,
  // and the email stays in sync if the user changed it in Cognito.
  const { rows } = await pool.query(
    `
    INSERT INTO users (cognito_id, first_name, last_name, email)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (cognito_id) DO UPDATE SET email = EXCLUDED.email
    RETURNING id
    `,
    [attr("sub"), attr("given_name"), attr("family_name"), attr("email")],
  );

  return rows[0].id;
};
