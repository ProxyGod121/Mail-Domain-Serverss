import { lt, eq, and } from "drizzle-orm";
import { db, sessionsTable, emailsTable } from "@workspace/db";
import { logger } from "./logger";

async function runCleanup() {
  try {
    const now = new Date();

    // Delete expired sessions
    const deletedSessions = await db
      .delete(sessionsTable)
      .where(lt(sessionsTable.expiresAt, now))
      .returning({ id: sessionsTable.id });

    // Delete emails in trash older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deletedEmails = await db
      .delete(emailsTable)
      .where(
        and(
          eq(emailsTable.folder, "trash"),
          lt(emailsTable.createdAt, thirtyDaysAgo)
        )
      )
      .returning({ id: emailsTable.id });

    // Delete orphaned drafts older than 60 days
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const deletedDrafts = await db
      .delete(emailsTable)
      .where(
        and(
          eq(emailsTable.isDraft, true),
          lt(emailsTable.createdAt, sixtyDaysAgo)
        )
      )
      .returning({ id: emailsTable.id });

    if (
      deletedSessions.length > 0 ||
      deletedEmails.length > 0 ||
      deletedDrafts.length > 0
    ) {
      logger.info(
        {
          sessions: deletedSessions.length,
          trashedEmails: deletedEmails.length,
          oldDrafts: deletedDrafts.length,
        },
        "Cleanup completed"
      );
    }
  } catch (err) {
    logger.error({ err }, "Cleanup job failed");
  }
}

export function startCleanupJob() {
  // Run once at startup
  runCleanup();
  // Then every hour
  const HOUR = 60 * 60 * 1000;
  setInterval(runCleanup, HOUR);
  logger.info("Cleanup job scheduled (every 1h)");
}
