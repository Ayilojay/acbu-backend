import { Request } from "express";
import { AppError } from "../middleware/errorHandler";

const ETAG_PATTERN = /^W\/"(.+)"$|^"(.+)"$/;

export function formatWalletEtag(version: number): string {
  return `"${version}"`;
}

export function parseIfMatchHeader(headerValue: string | undefined): number | null {
  if (!headerValue) return null;

  const raw = headerValue
    .split(",")
    .map((part) => part.trim())
    .find((part) => part !== "*");

  if (!raw) return null;

  const match = raw.match(ETAG_PATTERN);
  const token = match?.[1] ?? match?.[2];
  if (!token) return null;

  const version = Number.parseInt(token, 10);
  return Number.isInteger(version) && version >= 0 ? version : null;
}

export function getIfMatchHeader(req: Request): string | undefined {
  const header = req.header("if-match");
  return header ?? undefined;
}

export function assertIfMatchHeaderPresent(ifMatch: string | undefined): number {
  const version = parseIfMatchHeader(ifMatch);
  if (version === null) {
    throw new AppError(
      "If-Match header with wallet ETag is required for this operation",
      428,
      "PRECONDITION_REQUIRED",
    );
  }
  return version;
}

export function setWalletEtagHeader(
  setHeader: (name: string, value: string) => void,
  version: number,
): void {
  setHeader("ETag", formatWalletEtag(version));
}
