import { NewsForm } from "@/components/organisms/admin/news-form";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/rbac";

export default async function NewNewsPage() {
  await requirePagePermission("news:manage");
  const session = await auth();
  const canApprove = hasPermission(session, "news:approve");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva nota</h1>
      <NewsForm canApprove={canApprove} />
    </div>
  );
}
