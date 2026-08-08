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

// A real access token never carries an `aud` claim; a 2FA-challenge token
// always does (see below) — both are signed with the same RS256 keypair, so
// this check is the entire security boundary between the two token types,
// not a nice-to-have. Without it, a challenge token (issued before 2FA is
// verified) would decode successfully here too, since jwt.verify only
// enforces `audience` when that option is explicitly passed.
export function verifyAccessToken(token: string): AccessTokenClaims {
  const claims = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
  if (claims.aud) throw new Error("Not a valid access token");
  return claims as unknown as AccessTokenClaims;
}

export interface TwoFaChallengeClaims {
  sub: string; // user id
  orgId: string;
}

const TWO_FA_CHALLENGE_AUDIENCE = "2fa-challenge";
const TWO_FA_CHALLENGE_TTL_SECONDS = 5 * 60;

// Issued at password-verified-but-2FA-not-yet-confirmed login — deliberately
// cannot be used as a real access token (requireAuth's verifyAccessToken call
// rejects any `aud` claim) and expires quickly, since its only purpose is to
// survive the short hop from /login to /2fa/verify.
export function signTwoFaChallengeToken(claims: TwoFaChallengeClaims): string {
  return jwt.sign(claims, privateKey, {
    algorithm: "RS256",
    expiresIn: TWO_FA_CHALLENGE_TTL_SECONDS,
    audience: TWO_FA_CHALLENGE_AUDIENCE,
  });
}

export function verifyTwoFaChallengeToken(token: string): TwoFaChallengeClaims {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    audience: TWO_FA_CHALLENGE_AUDIENCE,
  }) as unknown as TwoFaChallengeClaims;
}

export interface EmailVerificationClaims {
  sub: string; // user id
  orgId: string;
}

const EMAIL_VERIFICATION_AUDIENCE = "email-verification";
const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;

// Same structural-distinctness precedent as the 2FA challenge token above —
// a verification link is emailed out and may sit unopened for a while, so it
// gets its own audience (never accepted as an access token) and a much
// longer TTL (24h vs the challenge token's 5 minutes, which only needs to
// survive one immediate redirect).
export function signEmailVerificationToken(claims: EmailVerificationClaims): string {
  return jwt.sign(claims, privateKey, {
    algorithm: "RS256",
    expiresIn: EMAIL_VERIFICATION_TTL_SECONDS,
    audience: EMAIL_VERIFICATION_AUDIENCE,
  });
}

export function verifyEmailVerificationToken(token: string): EmailVerificationClaims {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    audience: EMAIL_VERIFICATION_AUDIENCE,
  }) as unknown as EmailVerificationClaims;
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
