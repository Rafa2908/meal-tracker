import {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { generateSecretHash } from "../utils/secretHash.js";
import { cognitoClient } from "../config/cognito.js";
import { provisionUser } from "../services/user.service.js";

// Map Cognito error names to responses the client can act on.
// Anything not listed is unexpected and goes to errorMiddleware as a 500.
const SIGNUP_ERRORS = {
  UsernameExistsException: [409, "An account with this email already exists"],
  InvalidPasswordException: [400, "Password does not meet the requirements"],
  InvalidParameterException: [400, "Invalid sign-up details"],
  TooManyRequestsException: [429, "Too many attempts, try again later"],
};

const isBlank = (value) => typeof value !== "string" || !value.trim();

export const signUp = async (req, res, next) => {
  const { email, password, first_name, last_name } = req.body ?? {};

  if ([email, password, first_name, last_name].some(isBlank)) {
    return res.status(400).json({
      message: "email, password, first_name and last_name are required",
    });
  }

  try {
    const response = await cognitoClient.send(
      new SignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: generateSecretHash(email),
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "given_name", Value: first_name.trim() },
          { Name: "family_name", Value: last_name.trim() },
        ],
      }),
    );

    return res.status(201).json({
      message: "Check your email for a confirmation code",
      userSub: response.UserSub,
    });
  } catch (error) {
    const mapped = SIGNUP_ERRORS[error.name];
    if (mapped) return res.status(mapped[0]).json({ message: mapped[1] });
    next(error);
  }
};

export const confirmSignUp = async (req, res, next) => {
  const { email, code } = req.body ?? {};

  if (isBlank(email) || isBlank(code)) {
    return res.status(400).json({ message: "email and code are required" });
  }

  try {
    await cognitoClient.send(
      new ConfirmSignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: generateSecretHash(email),
        Username: email,
        ConfirmationCode: code,
      }),
    );
  } catch (error) {
    if (
      error.name === "CodeMismatchException" ||
      error.name === "ExpiredCodeException"
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (error.name === "NotAuthorizedException") {
      // Cognito returns this when the account is already confirmed
      return res.status(400).json({ message: "Account is already confirmed" });
    }

    return next(error);
  }

  try {
    await provisionUser(email);
  } catch (error) {
    // The account is confirmed. If this insert failed, authenticate()
    // creates the row on the user's first request, so don't fail the confirm.
    console.error("Deferred user provisioning:", error.message);
  }

  return res.status(201).json({ message: "Account confirmed" });
};

export const login = async (req, res, next) => {
  const { email, password } = req.body ?? {};

  if (isBlank(email) || isBlank(password)) {
    return res.status(400).json({ message: "email and password are required" });
  }

  try {
    const { AuthenticationResult } = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          SECRET_HASH: generateSecretHash(email),
        },
      }),
    );

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

    next(error);
  }
};

// With a client secret, REFRESH_TOKEN_AUTH needs a SECRET_HASH computed from
// the Cognito *username*. If the pool signs users in with email as a username
// attribute, that username is the user's `sub` (readable from the ID token).
// If email IS the username in your pool, the client should send the email here.
export const refresh = async (req, res, next) => {
  const { refreshToken, sub } = req.body ?? {};

  if (isBlank(refreshToken) || isBlank(sub)) {
    return res
      .status(400)
      .json({ message: "refreshToken and sub are required" });
  }

  try {
    const { AuthenticationResult } = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: generateSecretHash(sub),
        },
      }),
    );

    return res.status(200).json({
      idToken: AuthenticationResult.IdToken,
      accessToken: AuthenticationResult.AccessToken,
      expiresIn: AuthenticationResult.ExpiresIn,
    });
  } catch (error) {
    if (error.name === "NotAuthorizedException") {
      return res
        .status(401)
        .json({ message: "Session expired, please log in again" });
    }

    next(error);
  }
};
