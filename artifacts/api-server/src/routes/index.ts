import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import emailsRouter from "./emails";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(emailsRouter);

export default router;
