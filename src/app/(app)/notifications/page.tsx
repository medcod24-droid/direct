import Link from "next/link";
import { requireAuth } from "@/lib/authz/guard";
import { relativeDays } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MarkAllRead, MarkRead } from "./NotificationActions";

export const metadata = { title: "Notifications — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const notifications = await ctx.db.notification.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} non lue(s)`}
        actions={<MarkAllRead unread={unread} />}
      />
      <Card>
        {notifications.length === 0 ? (
          <EmptyState title="Aucune notification" description="Vous serez prévenu ici des échéances et des pièces reçues." />
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
              <li key={notification.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-sm ${notification.readAt ? "text-ink2" : "font-medium"}`}>
                      {notification.link ? (
                        <Link href={notification.link} className="hover:underline underline-offset-2">
                          {notification.title}
                        </Link>
                      ) : (
                        notification.title
                      )}
                    </div>
                    {notification.body ? (
                      <div className="text-xs text-muted">{notification.body}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap text-xs text-muted">
                      {relativeDays(notification.createdAt)}
                    </span>
                    {notification.readAt ? null : <MarkRead id={notification.id} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
