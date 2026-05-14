import { notFound } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-helpers";
import FileStatsClient from "@/components/stats/FileStatsClient";

export const dynamic = "force-dynamic";

export default async function FileStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireSessionUser();
  if (!me) return notFound();
  const { id } = await params;
  return <FileStatsClient fileId={id} />;
}
