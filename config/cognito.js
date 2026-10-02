import "dotenv/config";
import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";

export const cognitoClient = new CognitoIdentityProvider({
  region: process.env.AWS_REGION,
});
