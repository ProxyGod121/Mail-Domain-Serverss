import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import emailsRouter from "./emails";
import inboundRouter from "./inbound";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(emailsRouter);
router.use(inboundRouter);

export default router;
