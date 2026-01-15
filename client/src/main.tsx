import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getLoginUrl } from "./const";
import { storeCognitoTokensFromUrl } from "./lib/cognito";
import { ApiError } from "@/lib/api";
import "./index.css";

storeCognitoTokensFromUrl();

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (analyticsEndpoint && analyticsWebsiteId && typeof document !== "undefined") {
  const script = document.createElement("script");
  const baseUrl = analyticsEndpoint.endsWith("/")
    ? analyticsEndpoint.slice(0, -1)
    : analyticsEndpoint;
  script.src = `${baseUrl}/umami`;
  script.defer = true;
  script.dataset.websiteId = analyticsWebsiteId;
  document.head.appendChild(script);
}

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof ApiError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.status === 401 || error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  const currentPath = window.location.pathname;
  window.location.href = getLoginUrl(currentPath);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
