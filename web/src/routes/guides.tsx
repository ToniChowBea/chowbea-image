import { Outlet, createFileRoute } from "@tanstack/react-router"

/** Layout for /guides and /guides/$slug — child routes fill the outlet. */
export const Route = createFileRoute("/guides")({
  component: GuidesLayout,
})

function GuidesLayout() {
  return <Outlet />
}
