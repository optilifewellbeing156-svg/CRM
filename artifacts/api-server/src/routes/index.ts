import { Router, type IRouter, type Response } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import purchasesRouter from "./purchases";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import salesReportRouter from "./sales-report";
import invoiceRouter from "./invoice";
import { requireAuth, type AuthRequest } from "../lib/middleware";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);

// /auth/me lives here so it goes through requireAuth (including the isActive DB check)
router.get("/auth/me", (req: AuthRequest, res: Response) => {
  const auth = req.auth!;
  res.json({
    userId: auth.userId,
    username: auth.username,
    role: auth.role,
    permissions: auth.permissions,
  });
});

router.use(productsRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(purchasesRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(salesReportRouter);
router.use(invoiceRouter);

export default router;
