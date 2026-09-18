import { NewsForm } from "@/components/organisms/admin/news-form";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/rbac";

export default async function NewNewsPage() {
  await requirePagePermission("news:manage");
  const session = await auth();
  const canApprove = hasPermission(session?.role, "news:approve");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <NewsForm canApprove={canApprove} />
    </div>
  );
}
