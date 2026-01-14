import { describe, expect, it, vi, beforeEach } from "vitest";
import { SecurityService } from "./security";

// データベースをモック
vi.mock("./db", () => ({
  getUserById: vi.fn().mockResolvedValue({
    id: 1,
    role: "user",
  }),
  getSessionById: vi.fn().mockResolvedValue({
    id: 123,
    userId: 1,
  }),
}));

describe("SecurityService", () => {
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = SecurityService.getInstance();
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt data correctly", async () => {
      const originalData = "This is sensitive conversation data";
      
      const encrypted = await securityService.encrypt(originalData);
      
      // 暗号化されたデータは元のデータと異なる
      expect(encrypted).not.toBe(originalData);
      
      // 暗号化データはIV:AuthTag:暗号文の形式
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      
      // 復号化すると元のデータに戻る
      const decrypted = securityService.decrypt(encrypted);
      expect(decrypted).toBe(originalData);
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", async () => {
      const data = "Same data";
      
      const encrypted1 = await securityService.encrypt(data);
      const encrypted2 = await securityService.encrypt(data);
      
      // 同じデータでも異なる暗号文になる（IVがランダムなため）
      expect(encrypted1).not.toBe(encrypted2);
      
      // しかし両方とも正しく復号化できる
      expect(securityService.decrypt(encrypted1)).toBe(data);
      expect(securityService.decrypt(encrypted2)).toBe(data);
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      const identifier = `test-user-${Date.now()}`;
      
      const result = await securityService.checkRateLimit(identifier, 5, 60000);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should block requests exceeding limit", async () => {
      const identifier = `rate-limit-test-${Date.now()}`;
      const limit = 3;
      
      // 制限内のリクエスト
      for (let i = 0; i < limit; i++) {
        const result = await securityService.checkRateLimit(identifier, limit, 60000);
        expect(result.allowed).toBe(true);
      }
      
      // 制限を超えたリクエスト
      const blockedResult = await securityService.checkRateLimit(identifier, limit, 60000);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });
  });

  describe("sanitizeInput", () => {
    it("should remove HTML tags", async () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello';
      
      const { sanitized, wasModified } = await securityService.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("</script>");
      expect(wasModified).toBe(true);
    });

    it("should escape dangerous characters", async () => {
      // HTMLタグはまず削除され、その後特殊文字がエスケープされる
      const input = 'Test & "quotes"';
      
      const { sanitized } = await securityService.sanitizeInput(input);
      
      expect(sanitized).toContain("&amp;");
      expect(sanitized).toContain("&quot;");
    });

    it("should not modify safe input", async () => {
      const safeInput = "This is a normal conversation about security.";
      
      const { sanitized, wasModified } = await securityService.sanitizeInput(safeInput);
      
      expect(sanitized).toBe(safeInput);
      expect(wasModified).toBe(false);
    });
  });

  describe("verifyAccess", () => {
    it("should return true for valid access", async () => {
      const result = await securityService.verifyAccess(1, "session", 123, "read");
      
      expect(result).toBe(true);
    });
  });

  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = SecurityService.getInstance();
      const instance2 = SecurityService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});
