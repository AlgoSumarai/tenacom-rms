import { Workspace } from "@/components/session";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Workspace>{children}</Workspace>;
}
