import { redirect } from "next/navigation";
import { owner } from "../../lib/crm-server";
import Admin from "./workspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await owner())) redirect("/admin/login");
  return <Admin />;
}
