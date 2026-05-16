import { Router, type IRouter } from "express";
import { eq, and, or, desc, count, sql } from "drizzle-orm";
import { db, emailsTable, usersTable } from "@workspace/db";
import {
  ListEmailsQueryParams,
  SendEmailBody,
  GetEmailParams,
  UpdateEmailParams,
  UpdateEmailBody,
  DeleteEmailParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const router: IRouter = Router();

router.get("/emails/stats", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const folders = ["inbox", "sent", "drafts", "trash", "starred"] as const;

  const statsRows = await db
    .select({
      folder: emailsTable.folder,
      isStarred: emailsTable.isStarred,
      isRead: emailsTable.isRead,
      cnt: count(),
    })
    .from(emailsTable)
    .where(
      or(
        eq(emailsTable.toUserId, user.id),
        eq(emailsTable.fromUserId, user.id),
      )
    )
    .groupBy(emailsTable.folder, emailsTable.isStarred, emailsTable.isRead);

  const stats: Record<string, number> = {
    inbox: 0,
    sent: 0,
    drafts: 0,
    trash: 0,
    starred: 0,
    total: 0,
  };

  for (const row of statsRows) {
    const c = Number(row.cnt);
    if (row.folder === "inbox" && !row.isRead) stats.inbox += c;
    if (row.folder === "sent") stats.sent += c;
    if (row.folder === "drafts") stats.drafts += c;
    if (row.folder === "trash") stats.trash += c;
    if (row.isStarred) stats.starred += c;
    stats.total += c;
  }

  res.json(stats);
});

router.get("/emails", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const parsed = ListEmailsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { folder, search, page, limit } = parsed.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  let whereClause;

  if (folder === "sent") {
    whereClause = and(
      eq(emailsTable.fromUserId, user.id),
      eq(emailsTable.folder, "sent"),
    );
  } else if (folder === "drafts") {
    whereClause = and(
      eq(emailsTable.fromUserId, user.id),
      eq(emailsTable.isDraft, true),
    );
  } else if (folder === "starred") {
    whereClause = and(
      or(
        eq(emailsTable.toUserId, user.id),
        eq(emailsTable.fromUserId, user.id),
      ),
      eq(emailsTable.isStarred, true),
    );
  } else if (folder === "trash") {
    whereClause = and(
      or(
        eq(emailsTable.toUserId, user.id),
        eq(emailsTable.fromUserId, user.id),
      ),
      eq(emailsTable.folder, "trash"),
    );
  } else {
    // inbox
    whereClause = and(
      eq(emailsTable.toUserId, user.id),
      eq(emailsTable.folder, "inbox"),
    );
  }

  const emails = await db
    .select()
    .from(emailsTable)
    .where(whereClause)
    .orderBy(desc(emailsTable.createdAt))
    .limit(limit ?? 20)
    .offset(offset);

  const [totalRow] = await db
    .select({ cnt: count() })
    .from(emailsTable)
    .where(whereClause);

  const result = emails.map((e) => ({
    id: e.id,
    fromEmail: e.fromEmail,
    fromName: e.fromName,
    toEmail: e.toEmail,
    toName: e.toName,
    subject: e.subject,
    body: e.body,
    folder: e.folder,
    isRead: e.isRead,
    isStarred: e.isStarred,
    isDraft: e.isDraft,
    createdAt: e.createdAt.toISOString(),
    replyToId: e.replyToId,
  }));

  res.json({
    emails: result,
    total: Number(totalRow?.cnt ?? 0),
    page: page ?? 1,
    limit: limit ?? 20,
  });
});

router.post("/emails", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const parsed = SendEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { toEmail, subject, body, isDraft, replyToId } = parsed.data;

  let toUserId: number | null = null;
  let toName = toEmail;

  const [recipient] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, toEmail.toLowerCase()));

  if (recipient) {
    toUserId = recipient.id;
    toName = recipient.displayName;
  }

  if (isDraft) {
    const [email] = await db.insert(emailsTable).values({
      fromUserId: user.id,
      fromEmail: user.email,
      fromName: user.displayName,
      toUserId,
      toEmail: toEmail.toLowerCase(),
      toName,
      subject,
      body,
      folder: "drafts",
      isDraft: true,
      isRead: true,
      replyToId: replyToId ?? null,
    }).returning();

    res.status(201).json({
      ...email,
      createdAt: email.createdAt.toISOString(),
    });
    return;
  }

  // Send email - creates entry in sender's sent folder
  const [sentEmail] = await db.insert(emailsTable).values({
    fromUserId: user.id,
    fromEmail: user.email,
    fromName: user.displayName,
    toUserId,
    toEmail: toEmail.toLowerCase(),
    toName,
    subject,
    body,
    folder: "sent",
    isDraft: false,
    isRead: true,
    replyToId: replyToId ?? null,
  }).returning();

  // If recipient is on our platform, deliver to their inbox
  if (toUserId) {
    await db.insert(emailsTable).values({
      fromUserId: user.id,
      fromEmail: user.email,
      fromName: user.displayName,
      toUserId,
      toEmail: toEmail.toLowerCase(),
      toName,
      subject,
      body,
      folder: "inbox",
      isDraft: false,
      isRead: false,
      replyToId: replyToId ?? null,
    });
  } else if (resend) {
    // Recipient is external — deliver via Resend
    await resend.emails.send({
      from: `${user.displayName} <${user.email}>`,
      to: toEmail.toLowerCase(),
      subject,
      text: body,
    });
  }

  res.status(201).json({
    ...sentEmail,
    createdAt: sentEmail.createdAt.toISOString(),
  });
});

router.get("/emails/:id", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const params = GetEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.id, params.data.id),
        or(
          eq(emailsTable.toUserId, user.id),
          eq(emailsTable.fromUserId, user.id),
        ),
      )
    );

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  // Mark as read if it's addressed to this user
  if (!email.isRead && email.toUserId === user.id) {
    await db
      .update(emailsTable)
      .set({ isRead: true })
      .where(eq(emailsTable.id, email.id));
  }

  res.json({
    ...email,
    isRead: email.toUserId === user.id ? true : email.isRead,
    createdAt: email.createdAt.toISOString(),
  });
});

router.patch("/emails/:id", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const params = UpdateEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateEmailBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.id, params.data.id),
        or(
          eq(emailsTable.toUserId, user.id),
          eq(emailsTable.fromUserId, user.id),
        ),
      )
    );

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  const updates: Partial<typeof email> = {};
  if (body.data.isRead !== undefined) updates.isRead = body.data.isRead;
  if (body.data.isStarred !== undefined) updates.isStarred = body.data.isStarred;
  if (body.data.folder !== undefined) updates.folder = body.data.folder;

  const [updated] = await db
    .update(emailsTable)
    .set(updates)
    .where(eq(emailsTable.id, email.id))
    .returning();

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/emails/:id", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const params = DeleteEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.id, params.data.id),
        or(
          eq(emailsTable.toUserId, user.id),
          eq(emailsTable.fromUserId, user.id),
        ),
      )
    );

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  await db.delete(emailsTable).where(eq(emailsTable.id, email.id));

  res.json({ success: true });
});

router.get("/contacts", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const rows = await db
    .select({
      email: emailsTable.fromEmail,
      displayName: emailsTable.fromName,
      emailCount: count(),
      lastEmailAt: sql<string>`MAX(${emailsTable.createdAt})`,
    })
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.toUserId, user.id),
        sql`${emailsTable.fromUserId} != ${user.id}`,
      )
    )
    .groupBy(emailsTable.fromEmail, emailsTable.fromName)
    .orderBy(desc(sql`MAX(${emailsTable.createdAt})`));

  const contacts = rows.map((r) => ({
    email: r.email,
    displayName: r.displayName,
    emailCount: Number(r.emailCount),
    lastEmailAt: new Date(r.lastEmailAt).toISOString(),
  }));

  res.json(contacts);
});

export default router;
