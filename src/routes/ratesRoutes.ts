import { Router, type IRouter } from "express";
import { getRates, getRatesQuote, getRatesBasket } from "../controllers/ratesController";
import { validateApiKey } from "../middleware/auth";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";
import { cacheSemiStatic } from "../middleware/cacheHeaders";

const router: IRouter = Router();
router.use(validateApiKey);
router.use(apiKeyRateLimiter);
router.get("/", cacheSemiStatic, getRates);
router.get("/quote", getRatesQuote);
router.get("/basket", cacheSemiStatic, getRatesBasket);
export default router;
