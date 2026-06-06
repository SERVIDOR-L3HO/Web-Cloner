import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inspectorRouter from "./inspector";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inspectorRouter);

export default router;
