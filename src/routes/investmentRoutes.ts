import { Router, type IRouter } from "express";
import { validateApiKey } from "../middleware/auth";
import { requireMinTier, requireSegmentScope } from "../middleware/segmentGuard";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";
import {
  postInvestmentWithdrawRequest,
  getInvestmentWithdrawRequests,
} from "../controllers/investmentController";

const router: IRouter = Router();

router.use(validateApiKey);
router.use(requireMinTier("verified"));
router.use(requireSegmentScope("investment:read", "investment:write"));
router.use(apiKeyRateLimiter);

/**
 * @swagger
 * tags:
 *   - name: Investment
 *     description: Investment withdrawal requests and tracking
 */

/**
 * @swagger
 * /v1/investment/withdraw/request:
 *   post:
 *     tags:
 *       - Investment
 *     summary: Request investment withdrawal
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount_acbu
 *               - audience
 *             properties:
 *               amount_acbu:
 *                 type: string
 *               audience:
 *                 type: string
 *                 enum: [retail, business]
 *               forced_removal:
 *                 type: boolean
 *     responses:
 *       202:
 *         description: Withdrawal request accepted
 */
router.post("/withdraw/request", postInvestmentWithdrawRequest);

/**
 * @swagger
 * /v1/investment/withdraw/requests:
 *   get:
 *     tags:
 *       - Investment
 *     summary: List investment withdrawal requests
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, available, completed, cancelled]
 *         description: Optional withdrawal status filter
 *     responses:
 *       200:
 *         description: List of withdrawal requests
 */
router.get("/withdraw/requests", getInvestmentWithdrawRequests);

export default router;
