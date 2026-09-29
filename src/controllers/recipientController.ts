import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { resolveRecipient } from "../services/recipient/recipientResolver";
import { AppError } from "../middleware/errorHandler";

/**
 * GET /recipient?q=@jane | +15551234567 | user@example.com
 * Returns recipient display info (no stellarAddress). Requires user-scoped API key.
 */
export async function getRecipient(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.apiKey?.userId ?? null;
    if (!userId) {
      throw new AppError("User-scoped API key required", 401);
    }
    const q = req.query.q;
    if (typeof q !== "string" || !q.trim()) {
      throw new AppError('Query parameter "q" is required', 400);
    }
    const result = await resolveRecipient(q.trim(), userId);
    if (!result) {
      throw new AppError("Recipient not found", 404);
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
}
