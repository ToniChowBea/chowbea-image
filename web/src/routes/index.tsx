import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">Chowbea Image</h1>
      <p className="text-gray-500">
        Scaffold booting. Tools land in later tasks.
      </p>
    </div>
  )
}
