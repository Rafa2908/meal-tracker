import crypto from "crypto";
import { generateSecretHash } from "../utils/secretHash";

const secret = (process.env.COGNITO_CLIENT_SECRET = "test-secret");
const clientId = (process.env.COGNITO_CLIENT_ID = "test-client-id");
const username = "test@test.com";

describe("Generate Secret Hash", () => {
  it("Returns true on successful hashing on username ", () => {
    const hash_test1 = generateSecretHash(username);
    const hash_test2 = crypto
      .createHmac("sha256", secret)
      .update(username + clientId)
      .digest("base64");

    expect(hash_test1).toBe(hash_test2);
  });
});
