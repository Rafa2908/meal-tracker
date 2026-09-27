import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";
import "dotenv/config";

export const cognitoClient = new CognitoIdentityProvider({
  region: process.env.AWS_REGION,
});
