import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authz/guard";

export default async function HomePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  redirect(ctx.membership.role === "client" ? "/portal" : "/dashboard");
}
