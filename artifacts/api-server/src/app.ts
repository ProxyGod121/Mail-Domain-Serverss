import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

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
app.use(cors({ origin: true, credentials: true }));

app.use(express.json({
  limit: "10mb",
  verify: (req: Request, _res: Response, buf: Buffer) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// Serve the favicon from the bundled public folder
const publicDir = path.resolve(process.cwd(), "artifacts/api-server/public");
const frontendDist = path.resolve(process.cwd(), "artifacts/mail/dist/public");

if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// API routes
app.use("/api", router);

// Serve the built frontend for all non-API routes (SPA fallback)
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
