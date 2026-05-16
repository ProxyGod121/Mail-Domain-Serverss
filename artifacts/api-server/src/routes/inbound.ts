import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/webhooks/inbound", async (req, res): Promise<void> => {
  const payload = req.body;

  // Resend email.received webhook format:
  // { type: "email.received", data: { from, to, subject, text, html, ... } }
  const data = payload.data ?? payload;

  const rawFrom: string = data.from ?? "";
  const rawTo: string | string[] = data.to ?? [];
  const subject: string = data.subject ?? "(no subject)";
  const body: string = data.text ?? data.html ?? "";

  // Parse "Display Name <email@example.com>" or plain "email@example.com"
  const parseAddress = (raw: string) => {
    const match = raw.match(/<([^>]+)>/);
    const email = (match ? match[1] : raw).toLowerCase().trim();
    const name = raw.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || email;
    return { email, name };
  };

  const { email: fromEmail, name: fromName } = parseAddress(rawFrom);

  const toList: string[] = Array.isArray(rawTo)
    ? rawTo
    : rawTo.split(",").map((s: string) => s.trim());

  let delivered = 0;

  for (const toRaw of toList) {
    const { email: toEmail } = parseAddress(toRaw);

    if (!toEmail.endsWith("@masonpowers.co")) continue;

    const [recipient] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, toEmail));

    if (!recipient) {
      req.log.warn({ toEmail }, "Inbound email: no matching user found");
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

    delivered++;
  }

  req.log.info({ fromEmail, toList, delivered }, "Inbound email processed");
  res.json({ ok: true, delivered });
});

export default router;
