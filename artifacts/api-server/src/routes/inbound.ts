import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, emailsTable, usersTable } from "@workspace/db";
import { createHmac, timingSafeEqual } from "crypto";

const router: IRouter = Router();

function verifySignature(req: Request): boolean {
  const secret = process.env["RESEND_WEBHOOK_SECRET"];
  if (!secret) return true; // skip verification if secret not configured

  const signature = req.headers["svix-signature"] as string | undefined;
  const msgId = req.headers["svix-id"] as string | undefined;
  const timestamp = req.headers["svix-timestamp"] as string | undefined;

  if (!signature || !msgId || !timestamp) return false;

  const body = JSON.stringify(req.body);
  const signedContent = `${msgId}.${timestamp}.${body}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const computed = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Resend sends multiple comma-separated signatures (v1,<sig>)
  const signatures = signature.split(" ");
  for (const sig of signatures) {
    const parts = sig.split(",");
    const sigValue = parts[parts.length - 1];
    try {
      if (
        timingSafeEqual(
          Buffer.from(computed),
          Buffer.from(sigValue ?? "")
        )
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function parseAddress(raw: string): { email: string; name: string } {
  const match = raw.match(/<([^>]+)>/);
  const email = (match ? match[1] : raw).toLowerCase().trim();
  const name = raw.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || email;
  return { email, name };
}

router.post("/webhooks/inbound", async (req: Request, res: Response): Promise<void> => {
  req.log.info({ headers: req.headers, body: req.body }, "Inbound webhook received");

  if (!verifySignature(req)) {
    req.log.warn("Inbound webhook: invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = req.body ?? {};

  // Support both { type, data } wrapper and flat payload
  const data = payload.data ?? payload;

  const rawFrom: string = data.from ?? data.sender ?? "";
  const rawTo: string | string[] = data.to ?? data.recipient ?? [];
  const subject: string = data.subject ?? "(no subject)";
  const body: string = data.text ?? data.html ?? data.body ?? "";

  if (!rawFrom) {
    req.log.warn({ payload }, "Inbound webhook: missing from field");
    res.json({ ok: true, delivered: 0, reason: "no sender" });
    return;
  }

  const { email: fromEmail, name: fromName } = parseAddress(rawFrom);

  const toList: string[] = Array.isArray(rawTo)
    ? rawTo.map((t) => (typeof t === "string" ? t : String(t)))
    : String(rawTo)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

  req.log.info({ fromEmail, toList, subject }, "Processing inbound email");

  let delivered = 0;

  for (const toRaw of toList) {
    const { email: toEmail } = parseAddress(toRaw);

    if (!toEmail.endsWith("@masonpowers.co")) {
      req.log.info({ toEmail }, "Skipping non-masonpowers.co recipient");
      continue;
    }

    const [recipient] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, toEmail));

    if (!recipient) {
      req.log.warn({ toEmail }, "No user found for inbound email");
      continue;
    }

    await db.insert(emailsTable).values({
      fromUserId: null,
      fromEmail,
      fromName,
      toUserId: recipient.id,
      toEmail,
      toName: recipient.displayName,
      subject,
      body,
      folder: "inbox",
      isDraft: false,
      isRead: false,
      replyToId: null,
    });

    req.log.info({ fromEmail, toEmail }, "Inbound email delivered to inbox");
    delivered++;
  }

  res.json({ ok: true, delivered });
});

export default router;
