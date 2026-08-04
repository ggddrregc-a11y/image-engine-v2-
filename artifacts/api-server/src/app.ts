import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// JSON 404 handler — catches any /api/* route not matched above
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// JSON error handler — ensures errors never return HTML
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { status?: number; statusCode?: number })?.statusCode ?? 500;
  res.status(status).json({ error: message });
});

export default app;
