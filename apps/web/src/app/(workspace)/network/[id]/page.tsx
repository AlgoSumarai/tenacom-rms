import { ProfileEditor } from "@/components/profile-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProfileEditor id={id} />;
}
