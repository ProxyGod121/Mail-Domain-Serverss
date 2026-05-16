import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/webhooks/inbound", async (req, res): Promise<void> => {
  const payload = req.body;

  // Resend inbound format
  const from: string = payload.from ?? payload.data?.from ?? "";
  const toField: string | string[] =
    payload.to ?? payload.data?.to ?? payload.data?.headers?.to ?? "";
  const subject: string = payload.subject ?? payload.data?.subject ?? "(no subject)";
  const body: string =
    payload.text ?? payload.data?.text ?? payload.html ?? payload.data?.html ?? "";

  const toAddresses: string[] = Array.isArray(toField)
    ? toField
    : toField.split(",").map((a: string) => a.trim());

  const fromName = from.replace(/<[^>]+>/, "").trim() || from;
  const fromEmail = (from.match(/<([^>]+)>/) ?? [, from])[1]?.toLowerCase() ?? from.toLowerCase();

  let delivered = 0;

  for (const toRaw of toAddresses) {
    const toEmail = (toRaw.match(/<([^>]+)>/) ?? [, toRaw])[1]?.toLowerCase() ?? toRaw.toLowerCase();

    if (!toEmail.endsWith("@masonpowers.co")) continue;

    const [recipient] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, toEmail));

    if (!recipient) continue;

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

  req.log.info({ fromEmail, toAddresses, delivered }, "Inbound email processed");
  res.json({ ok: true, delivered });
});

export default router;
