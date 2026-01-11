import { ForbiddenError } from "@shared/_core/errors";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const getIssuer = () => {
  if (!ENV.cognitoRegion || !ENV.cognitoUserPoolId) return "";
  return `https://cognito-idp.${ENV.cognitoRegion}.amazonaws.com/${ENV.cognitoUserPoolId}`;
};

const jwksUrl =
  ENV.cognitoJwksUrl ||
  (ENV.cognitoRegion && ENV.cognitoUserPoolId
    ? `${getIssuer()}/.well-known/jwks.json`
    : "");

const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;

function getBearerToken(req: Request): string | null {
  const header =
    req.headers.authorization ||
    (req.headers as Record<string, string | string[] | undefined>).Authorization;
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  const [type, token] = value.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function authenticateRequest(req: Request): Promise<User> {
  const token = getBearerToken(req);
  if (!token) {
    throw ForbiddenError("Missing Authorization token");
  }
  if (!jwks || !ENV.cognitoClientId) {
    throw ForbiddenError("Cognito auth is not configured");
  }

  const issuer = getIssuer();
  if (!issuer) {
    throw ForbiddenError("Cognito issuer is not configured");
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: ENV.cognitoClientId,
  });

  if (payload.token_use && payload.token_use !== "id") {
    throw ForbiddenError("Invalid token type");
  }

  const openId = typeof payload.sub === "string" ? payload.sub : null;
  if (!openId) {
    throw ForbiddenError("Invalid token payload");
  }

  const name = typeof payload.name === "string" ? payload.name : null;
  const email = typeof payload.email === "string" ? payload.email : null;

  let user = await db.getUserByOpenId(openId);
  if (!user) {
    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "cognito",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(openId);
  } else {
    await db.upsertUser({
      openId,
      name: name ?? user.name ?? null,
      email: email ?? user.email ?? null,
      loginMethod: user.loginMethod ?? "cognito",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(openId);
  }

  if (!user) {
    throw ForbiddenError("User not found");
  }

  return user;
}
