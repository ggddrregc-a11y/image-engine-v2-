import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import comfyRouter from "./comfy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(comfyRouter);

export default router;
