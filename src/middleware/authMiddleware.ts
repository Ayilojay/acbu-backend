import jwt, { type JwtPayload, type Secret, type VerifyOptions } from "jsonwebtoken";

export const EXPECTED_JWT_TYP = "JWT";

export function getJwtHeader(token: string): jwt.JwtHeader | null {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string") {
    return null;
  }

  return decoded.header;
}

/**
 * Reject JWT confusion attacks where a valid OAuth access token (e.g. typ "at+JWT")
 * from the same issuer could otherwise be accepted as an application JWT.
 */
export function assertJwtTypHeader(token: string): void {
  const header = getJwtHeader(token);
  if (!header?.typ) {
    throw new jwt.JsonWebTokenError("jwt typ header is required");
  }

  const normalizedTyp = header.typ.trim();
  if (normalizedTyp.toUpperCase() !== EXPECTED_JWT_TYP) {
    throw new jwt.JsonWebTokenError(`unexpected jwt typ: ${header.typ}`);
  }
}

export function verifyJwt(
  token: string,
  secret: Secret,
  options?: VerifyOptions,
): JwtPayload | string {
  assertJwtTypHeader(token);
  return jwt.verify(token, secret, options);
}
