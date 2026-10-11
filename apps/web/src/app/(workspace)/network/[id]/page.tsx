import { ProfileDetail } from "@/components/profile-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProfileDetail id={id} />;
}
