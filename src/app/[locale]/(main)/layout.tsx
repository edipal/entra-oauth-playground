import Layout from "@/components/layout/layout";

export default function MainLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
