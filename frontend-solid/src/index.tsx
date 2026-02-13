/* @refresh reload */
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { render } from "solid-js/web"
import App from "@/app"
import "@/index.css"

const root = document.getElementById("root")
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  ),
  root!,
)
