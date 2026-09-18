import { NewsForm } from "@/components/organisms/admin/news-form";
import { auth } from "@/lib/auth";
import { getNewsPostById } from "@/lib/db/news";
import { serializeJson } from "@/lib/json-bigint";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/rbac";
import type { NewsPost } from "@/types/prisma";
import { notFound, redirect } from "next/navigation";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("news:manage");
  const session = await auth();
  const canApprove = hasPermission(session?.role, "news:approve");

  const { id } = await params;
  const post = await getNewsPostById(id);
  if (!post) notFound();
  if (!canApprove && post.authorId !== session?.userId) {
    redirect("/admin/news");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <NewsForm
        post={serializeJson(post) as unknown as NewsPost}
        canApprove={canApprove}
      />
    </div>
  );
}
