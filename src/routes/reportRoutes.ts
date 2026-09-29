import { Router, type IRouter } from "express";
import { validateApiKey } from "../middleware/auth";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";
import { exportTransactionReport } from "../controllers/reportController";

const router: IRouter = Router();
router.use(validateApiKey);
router.use(apiKeyRateLimiter);

router.get("/transactions", exportTransactionReport);

export default router;
