import { requireStaff } from "@/lib/authz/guard";
import { listClientOptions } from "@/server/services/clients";
import { listStaffOptions } from "@/server/services/members";
import { listTodos } from "@/server/services/todos";
import { Alert, Card, EmptyState, PageHeader, SegmentedProgress } from "@/components/ui";
import { TodoCard, TodoForm, type TodoItem } from "./TodoCard";

export const metadata = { title: "To-do équipe — Direct Conseil" };
export const dynamic = "force-dynamic";

/**
 * Liste de tâches de l'équipe.
 *
 * Deux lectures d'un même écran. L'administrateur voit tout le monde, regroupé
 * par collaborateur, et confie le travail ; le collaborateur ne voit que ce qui
 * lui est confié — la répartition du travail des autres ne le regarde pas, et le
 * service applique cette restriction quoi qu'affiche la page.
 */
export default async function TodosPage() {
  const ctx = await requireStaff("todo.view");
  const canManage = ctx.can("todo.manage");

  const [todos, staff, clients] = await Promise.all([
    listTodos(ctx),
    canManage ? listStaffOptions(ctx) : Promise.resolve([]),
    canManage ? listClientOptions(ctx) : Promise.resolve([]),
  ]);

  const awaiting = todos.filter((todo) => todo.status === "submitted");
  const mine = todos.filter((todo) => todo.assigneeId === ctx.user.id);

  // Regroupement par collaborateur, dans l'ordre des noms.
  const byAssignee = new Map<string, TodoItem[]>();
  for (const todo of todos) {
    const list = byAssignee.get(todo.assigneeId);
    if (list) list.push(todo);
    else byAssignee.set(todo.assigneeId, [todo]);
  }
  const groups = [...byAssignee.entries()]
    .map(([assigneeId, items]) => ({
      assigneeId,
      name: items[0]?.assigneeName ?? "—",
      items,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const render = (todo: TodoItem) => (
    <TodoCard
      key={todo.id}
      todo={todo}
      canManage={canManage}
      isMine={todo.assigneeId === ctx.user.id}
      staff={staff}
      clients={clients}
    />
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Travail de l'équipe"
        title="To-do équipe"
        subtitle={
          canManage
            ? "Le travail confié à chaque collaborateur. Une tâche rendue passe en orange : elle attend votre confirmation."
            : "Ce que le cabinet attend de vous. Marquez une tâche comme faite en laissant une note."
        }
        actions={
          canManage ? (
            <TodoForm staff={staff} clients={clients} trigger="Confier une tâche" />
          ) : undefined
        }
      />

      {canManage && awaiting.length > 0 ? (
        <Alert tone="warning" title="Tâches rendues">
          {awaiting.length === 1
            ? "1 tâche rendue attend votre confirmation."
            : `${awaiting.length} tâches rendues attendent votre confirmation.`}{" "}
          Lisez la note du collaborateur avant de confirmer.
        </Alert>
      ) : null}

      {canManage && awaiting.length > 0 ? (
        <Card
          icon="clock"
          iconTone="warn"
          title="À confirmer"
          description="Tâches rendues par l'équipe, avec la note de chacun."
        >
          <div className="grid gap-2">{awaiting.map(render)}</div>
        </Card>
      ) : null}

      {canManage && mine.length > 0 ? (
        <Card icon="task" title="Mes tâches" description="Ce qui vous est confié à vous.">
          <div className="grid gap-2">{mine.map(render)}</div>
        </Card>
      ) : null}

      {canManage ? (
        groups.length === 0 ? (
          <Card icon="team" title="Par collaborateur">
            <EmptyState
              iconName="task"
              title="Aucune tâche confiée"
              description="Confiez le travail du jour à chaque membre de l'équipe : chacun le verra sur son tableau de bord."
            />
          </Card>
        ) : (
          groups.map((group) => (
            <Card
              key={group.assigneeId}
              icon="clients"
              title={group.name}
              description={summarize(group.items)}
              action={
                <TodoForm
                  staff={staff}
                  clients={clients}
                  defaultAssigneeId={group.assigneeId}
                  trigger="Ajouter"
                />
              }
            >
              {/* Où en est ce collaborateur, avant le détail de ses tâches. */}
              <SegmentedProgress
                className="mb-3"
                height={8}
                segments={[
                  {
                    label: "Confirmées",
                    value: group.items.filter((item) => item.status === "approved").length,
                    className: "bg-ok",
                  },
                  {
                    label: "Rendues",
                    value: group.items.filter((item) => item.status === "submitted").length,
                    className: "bg-accent",
                  },
                  {
                    label: "À faire",
                    value: group.items.filter(
                      (item) => item.status === "assigned" || item.status === "returned",
                    ).length,
                    className: "bg-warn",
                  },
                ]}
              />
              <div className="grid gap-2">{group.items.map(render)}</div>
            </Card>
          ))
        )
      ) : (
        <Card icon="task" title="Mes tâches">
          {todos.length === 0 ? (
            <EmptyState
              iconName="check"
              title="Rien à faire pour l'instant"
              description="Les tâches que l'administrateur vous confie apparaîtront ici et sur votre tableau de bord."
            />
          ) : (
            <div className="grid gap-2">{todos.map(render)}</div>
          )}
        </Card>
      )}
    </div>
  );
}

/** « 2 à faire · 1 à confirmer · 5 confirmées » — l'état d'un collaborateur en un coup d'œil. */
function summarize(items: TodoItem[]): string {
  const count = (status: string) => items.filter((item) => item.status === status).length;
  const parts = [
    [count("assigned"), "à faire"],
    [count("returned"), "renvoyée(s)"],
    [count("submitted"), "à confirmer"],
    [count("approved"), "confirmée(s)"],
  ] as const;

  return parts
    .filter(([value]) => value > 0)
    .map(([value, label]) => `${value} ${label}`)
    .join(" · ");
}
