import {
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminGetUserCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { generateSecretHash } from "../utils/secretHash.js";
import { cognitoClient } from "../config/cognito.js";
import { pool } from "../config/database.js";

export const signUp = async (req, res) => {
  const { email, first_name, last_name, password } = req.body;

  try {
    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: generateSecretHash(email),
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "given_name", Value: first_name },
        { Name: "family_name", Value: last_name },
      ],
    });

    const response = await cognitoClient.send(command);

    return res
      .status(201)
      .json({ message: "Check email inbox", userSub: response.UserSub });
  } catch (error) {
    console.error(error.name);

    return res
      .status(400)
      .json({ message: "An account with the given email already exists." });
  }
};

export const confirmSignUp = async (req, res) => {
  const { email, code } = req.body;

  try {
    const command = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: generateSecretHash(email),
      Username: email,
      ConfirmationCode: code,
    });

    await cognitoClient.send(command);

    const userInfo = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
      }),
    );

    const attributes = (name) =>
      userInfo.UserAttributes.find((a) => a.Name === name)?.Value;

    await pool.query(
      `
      INSERT INTO users(cognito_id, first_name, last_name, email)
      VALUES($1, $2, $3, $4)
      `,
      [
        attributes("sub"),
        attributes("given_name"),
        attributes("family_name"),
        attributes("email"),
      ],
    );

    return res.status(201).json({ message: "User sign up successfully" });
  } catch (error) {
    console.error(error.message);

    return res.status(400).json({ message: "Error signing up" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: generateSecretHash(email),
      },
    });

    const response = await cognitoClient.send(command);

    const { AuthenticationResult } = response;

    if (!AuthenticationResult) {
      return res.status(400).json({ message: "Unable to login" });
    }

    return res.status(200).json({
      idToken: AuthenticationResult.IdToken,
      accessToken: AuthenticationResult.AccessToken,
      refreshToken: AuthenticationResult.RefreshToken,
      expiresIn: AuthenticationResult.ExpiresIn,
    });
  } catch (error) {
    console.error(error);

    if (
      error.name === "NotAuthorizedException" ||
      error.name === "UserNotFoundException"
    ) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (error.name === "UserNotConfirmedException") {
      return res
        .status(403)
        .json({ message: "Please confirm your email first" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};
