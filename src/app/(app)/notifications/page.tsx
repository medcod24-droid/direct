import Link from "next/link";
import { requireAuth } from "@/lib/authz/guard";
import { relativeDays } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications — Daftar" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const notifications = await ctx.db.notification.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Notifications"
        subtitle={`${notifications.filter((n) => !n.readAt).length} non lue(s)`}
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
                  <span className="text-xs text-muted shrink-0">
                    {relativeDays(notification.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
