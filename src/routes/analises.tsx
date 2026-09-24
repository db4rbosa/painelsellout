import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getAccessInfo } from "@/lib/account.functions";

export const Route = createFileRoute("/analises")({
  ssr: false,
  loader: async () => {
    const identity = await getAccessInfo();
    if (identity.kind === "none") throw redirect({ to: "/unlock", search: { next: "/analises" } });
    if (identity.kind !== "user") throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
