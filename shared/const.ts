export const COOKIE_NAME = "app_session_id";
// セッション有効期限を7日に短縮（セキュリティ向上）
// 以前は1年（365日）でしたが、トークン漏洩時のリスクを軽減するため短縮
export const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7日
// 後方互換性のためONE_YEAR_MSを残す（非推奨）
/** @deprecated Use SESSION_EXPIRY_MS instead. This will be removed in a future version. */
export const ONE_YEAR_MS = SESSION_EXPIRY_MS;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
