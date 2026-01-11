/**
 * Cookie設定
 * 
 * セッションCookieの設定を管理する。
 * セキュリティを強化するため、HttpOnly、Secure、SameSite属性を適切に設定する。
 */
import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

/**
 * ローカルホストのホスト名のセット
 * 
 * 開発環境で使用されるローカルホストのホスト名を定義する。
 * これらのホスト名にはCookieのdomain属性を設定しない。
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * IPアドレスかどうかを判定する
 * 
 * ホスト名がIPアドレス（IPv4またはIPv6）かどうかを判定する。
 * IPv4の場合は数値パターンをチェックし、IPv6の場合は":"の存在をチェックする。
 * 
 * @param host - チェックするホスト名
 * @returns IPアドレスの場合はtrue、それ以外はfalse
 */
function isIpAddress(host: string) {
  // IPv4のパターンをチェック（例: 192.168.1.1）
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6の場合は":"が含まれる（例: ::1、2001:db8::1）
  return host.includes(":");
}

/**
 * セキュアなリクエストかどうかを判定する
 * 
 * リクエストがHTTPS経由かどうかを判定する。
 * プロキシ経由の場合は、X-Forwarded-Protoヘッダーを確認する。
 * 
 * 判定の流れ:
 * 1. req.protocolが"https"の場合はtrue
 * 2. X-Forwarded-Protoヘッダーが存在し、"https"を含む場合はtrue
 * 3. それ以外の場合はfalse
 * 
 * @param req - Expressリクエストオブジェクト
 * @returns HTTPSリクエストの場合はtrue、それ以外はfalse
 */
function isSecureRequest(req: Request) {
  // 直接HTTPS接続の場合
  if (req.protocol === "https") return true;

  // プロキシ経由の場合はX-Forwarded-Protoヘッダーを確認
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  // ヘッダー値が配列の場合は最初の要素を使用、文字列の場合はカンマで分割
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  // プロトコルリストに"https"が含まれるかチェック
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * セッションCookieのオプションを取得する
 * 
 * セキュリティを強化するため、セッションCookieに適切な属性を設定する。
 * 
 * Cookie属性の説明:
 * - httpOnly: JavaScriptからアクセス不可（XSS攻撃対策）
 * - secure: HTTPS接続時のみ送信（中間者攻撃対策）
 * - sameSite: CSRF攻撃対策（"strict"、"lax"、"none"）
 * - path: Cookieが有効なパス（"/"はすべてのパス）
 * 
 * SameSite属性の設定ルール:
 * - 環境変数で"none"が指定されている場合、secureがtrueの場合は"none"を使用
 * - secureがfalseの場合（HTTP接続）は、"none"を使用できないため"lax"にフォールバック
 * - それ以外の場合は、環境変数の値をそのまま使用
 * 
 * @param req - Expressリクエストオブジェクト
 * @returns Cookieオプションオブジェクト（domain、httpOnly、path、sameSite、secure）
 * 
 * @example
 * const cookieOptions = getSessionCookieOptions(req);
 * res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // ドメイン設定はコメントアウトされている
  // 必要に応じて、以下のロジックを使用してドメインを設定できる
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  // HTTPS接続かどうかを判定
  const isSecure = isSecureRequest(req);
  
  // 環境変数からSameSite属性を取得
  const requestedSameSite = ENV.cookieSameSite;
  
  // SameSite属性を決定
  // "none"が指定されているがsecureがfalseの場合（HTTP接続）は"lax"にフォールバック
  // "none"はsecureがtrueの場合（HTTPS接続）のみ使用できる
  const sameSite =
    requestedSameSite === "none" && !isSecure ? "lax" : requestedSameSite;

  return {
    /** JavaScriptからアクセス不可（XSS攻撃対策） */
    httpOnly: true,
    /** Cookieが有効なパス（"/"はすべてのパス） */
    path: "/",
    /** SameSite属性（"strict"、"lax"、"none"） */
    sameSite: sameSite === "strict" ? "strict" : sameSite === "none" ? "none" : "lax",
    /** HTTPS接続時のみ送信（中間者攻撃対策） */
    secure: isSecure,
  };
}
