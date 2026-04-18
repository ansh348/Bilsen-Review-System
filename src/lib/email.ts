import { Resend } from "resend";
import type { NotificationType } from "@/lib/review-types";

let resend: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const SUBJECT_MAP: Record<NotificationType, string> = {
  ASSIGNMENT_NEW: "New Review Assignment",
  ASSIGNMENT_ACCEPTED: "Assignment Accepted",
  ASSIGNMENT_DECLINED: "Assignment Declined",
  DEADLINE_REMINDER: "Deadline Reminder",
  DEADLINE_OVERDUE: "Assignment Overdue",
  REVIEW_SUBMITTED: "Review Submitted",
  RATING_RECEIVED: "Rating Received",
  COMPLIANCE_RESULT: "Compliance Check Result",
  EXTENSION_REQUESTED: "Extension Requested",
  EXTENSION_APPROVED: "Extension Approved",
  EXTENSION_DENIED: "Extension Denied",
  ROUND_COMPLETE: "Review Round Complete",
};

interface SendEmailInput {
  to: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

export async function sendNotificationEmail(input: SendEmailInput): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.error(`[email] RESEND_API_KEY not set — skipping ${input.type} email to ${input.to}`);
    return false;
  }

  const from = process.env.EMAIL_FROM || "BILSEN <noreply@bilsen.app>";
  const subject = SUBJECT_MAP[input.type] || input.title;
  const appUrl = process.env.AUTH_URL || "http://localhost:3000";
  const ctaUrl = input.link ? `${appUrl}${input.link}` : appUrl;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#1865F2;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">BILSEN</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">${input.title}</h2>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#374151;">${input.message}</p>
            <a href="${ctaUrl}" style="display:inline-block;background:#1865F2;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;">View Details</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;font-size:12px;color:#6b7280;">
            You received this email because of your BILSEN account settings.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  try {
    await client.emails.send({
      from,
      to: [input.to],
      subject,
      html,
    });
    console.log(`[email] Sent ${input.type} email to ${input.to}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send ${input.type} to ${input.to}:`, error);
    return false;
  }
}
