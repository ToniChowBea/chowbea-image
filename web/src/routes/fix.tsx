import { Outlet, createFileRoute } from "@tanstack/react-router"

/** Layout for /fix and /fix/$preset — child routes fill the outlet. */
export const Route = createFileRoute("/fix")({
  component: FixLayout,
})

function FixLayout() {
  return <Outlet />
}
