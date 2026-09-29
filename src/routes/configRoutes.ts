import { Router, type IRouter } from "express";
import { getPublicAssetsConfig } from "../controllers/configController";
import { cacheSemiStatic } from "../middleware/cacheHeaders";

const router: IRouter = Router();

// Public — no API key required. Used by the frontend to discover the exact
// ACBU asset (code + issuer) + Stellar network to sign trustlines against.
router.get("/assets", cacheSemiStatic, getPublicAssetsConfig);

export default router;
