import appleSignin from "apple-signin-auth";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config.js";

export type OAuthProfile = {
  subject: string;
  email?: string;
  displayName?: string;
};

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<OAuthProfile> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("Google OAuth is not configured");
  }

  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error("Invalid Google token");
  }

  return {
    subject: payload.sub,
    email: payload.email,
    displayName: payload.name,
  };
}

export async function verifyAppleIdToken(
  idToken: string,
): Promise<OAuthProfile> {
  if (!env.APPLE_CLIENT_ID) {
    throw new Error("Apple Sign In is not configured");
  }

  const payload = await appleSignin.verifyIdToken(idToken, {
    audience: env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });

  return {
    subject: payload.sub,
    email: payload.email,
    displayName: undefined,
  };
}
