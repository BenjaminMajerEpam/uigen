// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ set: mockCookieSet, get: mockCookieGet, delete: mockCookieDelete })
  ),
}));

const { createSession, getSession, deleteSession, verifySession } = await import("@/lib/auth");

const SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

describe("createSession", () => {
  beforeEach(() => {
    mockCookieSet.mockClear();
  });

  test("sets a cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");
    expect(mockCookieSet.mock.calls[0][0]).toBe("auth-token");
  });

  test("sets a JWT string as the cookie value", async () => {
    await createSession("user-1", "test@example.com");
    const token = mockCookieSet.mock.calls[0][1];
    // JWT tokens have three base64url parts separated by dots
    expect(token.split(".")).toHaveLength(3);
  });

  test("sets httpOnly and correct path", async () => {
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
  });

  test("sets expiry ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const expires: Date = mockCookieSet.mock.calls[0][2].expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("does not set secure in non-production environment", async () => {
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.secure).toBe(false);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
  });

  test("returns null when no cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const token = await makeToken({ userId: "user-1", email: "test@example.com" });
    mockCookieGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "user-1", email: "test@example.com" }, "-1s");
    mockCookieGet.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    mockCookieGet.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  beforeEach(() => {
    mockCookieDelete.mockClear();
  });

  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieDelete).toHaveBeenCalledWith("auth-token");
  });

  test("deletes exactly once", async () => {
    await deleteSession();
    expect(mockCookieDelete).toHaveBeenCalledTimes(1);
  });
});

describe("verifySession", () => {
  function makeRequest(token?: string) {
    return {
      cookies: {
        get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined),
      },
    } as any;
  }

  test("returns null when no cookie is present", async () => {
    expect(await verifySession(makeRequest())).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const token = await makeToken({ userId: "user-1", email: "test@example.com" });
    const session = await verifySession(makeRequest(token));
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "user-1", email: "test@example.com" }, "-1s");
    expect(await verifySession(makeRequest(token))).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    expect(await verifySession(makeRequest("not.a.jwt"))).toBeNull();
  });
});
