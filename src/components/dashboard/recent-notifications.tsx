import Link from "next/link";
import {
  Bell,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Star,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkAsReadButton } from "@/components/dashboard/mark-as-read-button";
import type { NotificationRecord, NotificationType } from "@/lib/review-types";

const iconMap: Record<NotificationType, typeof Bell> = {
  ASSIGNMENT_NEW: FileText,
  ASSIGNMENT_ACCEPTED: CheckCircle,
  ASSIGNMENT_DECLINED: AlertTriangle,
  DEADLINE_REMINDER: Clock,
  DEADLINE_OVERDUE: AlertTriangle,
  REVIEW_SUBMITTED: CheckCircle,
  RATING_RECEIVED: Star,
  COMPLIANCE_RESULT: Shield,
  EXTENSION_REQUESTED: Clock,
  EXTENSION_APPROVED: CheckCircle,
  EXTENSION_DENIED: AlertTriangle,
  ROUND_COMPLETE: CheckCircle,
  REVISION_REQUESTED: FileText,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface RecentNotificationsProps {
  notifications: NotificationRecord[];
}

export function RecentNotifications({ notifications }: RecentNotificationsProps) {
  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="text-base">Recent Notifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications.</p>
        ) : (
          notifications.map((notification) => {
            const Icon = iconMap[notification.type] ?? Bell;
            const textBody = (
              <>
                <p className={`text-sm ${!notification.read ? "font-semibold" : "font-medium"} text-foreground`}>
                  {notification.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timeAgo(notification.createdAt)}
                </p>
              </>
            );

            return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 rounded-lg border border-border/80 bg-background/35 p-3 transition-colors hover:bg-accent/45 ${
                  !notification.read ? "border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="mt-0.5 rounded-md bg-accent/85 p-1.5">
                  <Icon className="h-3.5 w-3.5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  {notification.link ? (
                    <Link href={notification.link} className="block">
                      {textBody}
                    </Link>
                  ) : (
                    textBody
                  )}
                  {notification.overleafUrl && (
                    <a
                      href={notification.overleafUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Open in Overleaf ↗
                    </a>
                  )}
                </div>
                {!notification.read && (
                  <MarkAsReadButton notificationId={notification.id} />
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
