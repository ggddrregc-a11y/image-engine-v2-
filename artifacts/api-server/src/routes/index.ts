import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import comfyRouter from "./comfy";
import editorRouter from "./editor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(comfyRouter);
router.use(editorRouter);

export default router;
