import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  RegisterBody,
  LoginBody,
  CheckUsernameQueryParams,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getUserFromRequest,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, displayName } = parsed.data;
  const normalizedUsername = username.toLowerCase().trim();

  if (!/^[a-z0-9._-]+$/i.test(normalizedUsername)) {
    res.status(400).json({ error: "Username can only contain letters, numbers, dots, hyphens and underscores" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, normalizedUsername));

  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const email = `${normalizedUsername}@masonpowers.co`;
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    username: normalizedUsername,
    email,
    displayName,
    passwordHash,
  }).returning();

  const token = await createSession(user.id);

  res.cookie("session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const normalizedUsername = username.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, normalizedUsername));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = await createSession(user.id);

  res.cookie("session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  req.log.info({ userId: user.id }, "User logged in");
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const cookieToken = req.cookies?.session_token;
  if (cookieToken) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, cookieToken));
  }
  res.clearCookie("session_token");
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/auth/check-username", async (req, res): Promise<void> => {
  const parsed = CheckUsernameQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "username query param required" });
    return;
  }

  const username = parsed.data.username.toLowerCase().trim();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  res.json({ available: !existing });
});

export default router;
