const ID_TOKEN_KEY = "cognito_id_token";

function parseHashParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#")) {
    return new URLSearchParams();
  }
  return new URLSearchParams(hash.slice(1));
}

export function storeCognitoTokensFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = parseHashParams();
  const idToken = params.get("id_token");
  if (!idToken) return;

  localStorage.setItem(ID_TOKEN_KEY, idToken);
  sessionStorage.removeItem("cognito_auth_nonce");

  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState({}, document.title, url.toString());
}

export function getCognitoIdToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ID_TOKEN_KEY);
}

export function clearCognitoTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ID_TOKEN_KEY);
}
