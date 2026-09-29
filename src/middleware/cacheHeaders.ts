import { Request, Response, NextFunction } from "express";

/**
 * Middleware to set Cache-Control and Surrogate-Control headers for semi-static API responses.
 * Max-age is set to 1 hour (3600 seconds), and CDNs (Surrogate-Control) can cache it for 24 hours (86400 seconds).
 */
export function cacheSemiStatic(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=600");
  res.setHeader("Surrogate-Control", "max-age=86400");
  next();
}
