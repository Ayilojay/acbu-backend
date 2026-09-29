import { Router, type IRouter } from "express";
import { validateApiKey } from "../middleware/auth";
import { requireMinTier, requireSegmentScope } from "../middleware/segmentGuard";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";
import { getRates } from "../controllers/ratesController";
import { createMintRoutes } from "./mintRoutes";
import { createBurnRoutes } from "./burnRoutes";

const router: IRouter = Router();

router.use(validateApiKey);
router.use(requireMinTier("verified"));
router.use(requireSegmentScope("international:read", "international:write"));
router.use(apiKeyRateLimiter);

router.get("/quote", getRates);
router.use("/mint", createMintRoutes());
router.use("/burn", createBurnRoutes());

export default router;
