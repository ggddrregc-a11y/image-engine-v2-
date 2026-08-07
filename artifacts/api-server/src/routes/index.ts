import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import comfyRouter from "./comfy";
import editorRouter from "./editor";
import chatRouter from "./chat";
import imageProvidersRouter from "./image-providers";
import videosRouter from "./videos/index.js";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(comfyRouter);
router.use(editorRouter);
router.use(chatRouter);
router.use(imageProvidersRouter);
router.use(videosRouter);
router.use(statsRouter);

export default router;
