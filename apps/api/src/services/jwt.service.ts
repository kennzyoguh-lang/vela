import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../lib/env";

// Access tokens: RS256, 60-minute expiry (Handbook 8.1) — asymmetric so a future
// extracted service (Horizon 3) can verify with only the public key, never
// holding a secret capable of issuing tokens.
const privateKey = Buffer.from(env.JWT_PRIVATE_KEY_BASE64, "base64").toString("utf8");
const publicKey = Buffer.from(env.JWT_PUBLIC_KEY_BASE64, "base64").toString("utf8");

export interface AccessTokenClaims {
  sub: string; // user id
  orgId: string;
  role: string;
  sessionFamilyId: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, privateKey, {
    algorithm: "RS256",
    expiresIn: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as unknown as AccessTokenClaims;
}

export function newRefreshToken(): { token: string; familyId: string } {
  // Opaque random token, not a JWT — stored hashed (session.service.ts), never
  // decodable client-side. familyId groups every rotation of one login session
  // so a stolen-and-reused refresh token invalidates the whole chain (Handbook 7.5).
  return { token: randomUUID() + randomUUID(), familyId: randomUUID() };
}

export function rotateRefreshToken(): string {
  return randomUUID() + randomUUID();
}
