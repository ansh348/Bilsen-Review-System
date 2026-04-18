import { NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/data-store";
import {
  createNotification,
  getPaperById,
  listUsers,
} from "@/lib/review-service";
import type { ReviewAssignmentRecord, NotificationRecord } from "@/lib/review-types";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — no secret required
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function wasNotifiedRecently(
  existing: NotificationRecord[],
  type: string,
  userId: string,
  assignmentId: string,
  withinMs: number
): boolean {
  const cutoff = new Date(Date.now() - withinMs).toISOString();
  return existing.some((n) => {
    const nKey = `${n.type}:${n.userId}:${n.link}`;
    return nKey === `${type}:${userId}:/reviews/${assignmentId}` && n.createdAt > cutoff;
  });
}

function handleReminders() {
  const assignments = readCollection("assignments");
  const notifications = readCollection("notifications");
  const users = listUsers();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const THREE_DAYS = 3 * ONE_DAY;

  const coordinators = users.filter((u) => u.role === "COORDINATOR");

  let remindersSent = 0;
  let overdueMarked = 0;

  const activeStatuses = new Set(["PENDING", "ACCEPTED", "IN_PROGRESS", "EXTENSION_REQUESTED"]);

  for (const assignment of assignments) {
    if (!activeStatuses.has(assignment.status)) continue;

    const deadlineMs = new Date(assignment.deadline).getTime();
    const msUntilDeadline = deadlineMs - now;

    const round = readCollection("rounds").find((r) => r.id === assignment.reviewRoundId);
    const paper = round ? getPaperById(round.paperId) : null;
    const paperTitle = paper?.title ?? "Unknown paper";

    if (msUntilDeadline < 0) {
      // Past due — mark overdue and notify
      if (assignment.status !== "OVERDUE") {
        const updated: ReviewAssignmentRecord = { ...assignment, status: "OVERDUE" };
        const allAssignments = readCollection("assignments").map((a) =>
          a.id === assignment.id ? updated : a
        );
        writeCollection("assignments", allAssignments);
        overdueMarked++;
      }

      if (!wasNotifiedRecently(notifications, "DEADLINE_OVERDUE", assignment.reviewerId, assignment.id, ONE_DAY)) {
        createNotification({
          userId: assignment.reviewerId,
          type: "DEADLINE_OVERDUE",
          title: "Assignment overdue",
          message: `Your review for "${paperTitle}" is past due.`,
          link: `/reviews/${assignment.id}`,
          sentViaEmail: true,
          sentViaSlack: false,
        });
        remindersSent++;

        for (const coord of coordinators) {
          if (!wasNotifiedRecently(notifications, "DEADLINE_OVERDUE", coord.id, assignment.id, ONE_DAY)) {
            createNotification({
              userId: coord.id,
              type: "DEADLINE_OVERDUE",
              title: "Reviewer overdue",
              message: `Review assignment for "${paperTitle}" is overdue.`,
              link: `/reviews/${assignment.id}`,
              sentViaEmail: true,
              sentViaSlack: false,
            });
            remindersSent++;
          }
        }
      }
    } else if (msUntilDeadline <= ONE_DAY) {
      // Due tomorrow
      if (!wasNotifiedRecently(notifications, "DEADLINE_REMINDER", assignment.reviewerId, assignment.id, ONE_DAY)) {
        createNotification({
          userId: assignment.reviewerId,
          type: "DEADLINE_REMINDER",
          title: "Deadline tomorrow",
          message: `Your review for "${paperTitle}" is due tomorrow.`,
          link: `/reviews/${assignment.id}`,
          sentViaEmail: true,
          sentViaSlack: false,
        });
        remindersSent++;
      }
    } else if (msUntilDeadline <= THREE_DAYS) {
      // Due within 3 days
      if (!wasNotifiedRecently(notifications, "DEADLINE_REMINDER", assignment.reviewerId, assignment.id, ONE_DAY)) {
        createNotification({
          userId: assignment.reviewerId,
          type: "DEADLINE_REMINDER",
          title: "Deadline approaching",
          message: `Your review for "${paperTitle}" is due in less than 3 days.`,
          link: `/reviews/${assignment.id}`,
          sentViaEmail: true,
          sentViaSlack: false,
        });
        remindersSent++;
      }
    }
  }

  return { remindersSent, overdueMarked };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = handleReminders();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = handleReminders();
  return NextResponse.json(result);
}
