import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initial state: isLoading is false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });

  describe("signIn", () => {
    test("sets isLoading to true during call and false after", async () => {
      let resolveSignIn!: (v: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((r) => { resolveSignIn = r; })
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: true });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("sets isLoading to false even when signIn action throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(result.current.signIn("user@example.com", "pass")).rejects.toThrow(
          "network error"
        );
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signInAction", async () => {
      const mockResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(mockResult);
      (getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue).toEqual(mockResult);
    });

    test("calls signInAction with provided email and password", async () => {
      (signInAction as any).mockResolvedValue({ success: false });
      (getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@test.com", "secret123");
      });

      expect(signInAction).toHaveBeenCalledWith("test@test.com", "secret123");
    });

    test("does not redirect on failed sign-in", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Bad credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrong");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    describe("handlePostSignIn: with anon work", () => {
      test("creates project from anon work, clears it, and redirects", async () => {
        const anonWork = {
          messages: [{ role: "user", content: "Hello" }],
          fileSystemData: { "/app.tsx": { content: "<App />" } },
        };
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(anonWork);
        (createProject as any).mockResolvedValue({ id: "anon-project-1" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^Design from /),
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        });
        expect(clearAnonWork).toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-1");
      });

      test("does not redirect using anon work when messages array is empty", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
        (getProjects as any).mockResolvedValue([{ id: "existing-1" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-1");
      });
    });

    describe("handlePostSignIn: no anon work, existing projects", () => {
      test("redirects to first project", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
        (getProjects as any).mockResolvedValue([
          { id: "proj-1" },
          { id: "proj-2" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/proj-1");
        expect(createProject).not.toHaveBeenCalled();
      });
    });

    describe("handlePostSignIn: no anon work, no existing projects", () => {
      test("creates a new project and redirects to it", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
        (getProjects as any).mockResolvedValue([]);
        (createProject as any).mockResolvedValue({ id: "new-proj-42" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/new-proj-42");
      });
    });
  });

  describe("signUp", () => {
    test("sets isLoading to true during call and false after", async () => {
      let resolveSignUp!: (v: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((r) => { resolveSignUp = r; })
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: true });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("sets isLoading to false even when signUp action throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("server error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(result.current.signUp("user@example.com", "pass")).rejects.toThrow(
          "server error"
        );
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signUpAction", async () => {
      const mockResult = { success: false, error: "Email taken" };
      (signUpAction as any).mockResolvedValue(mockResult);
      (getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("user@example.com", "pass");
      });

      expect(returnValue).toEqual(mockResult);
    });

    test("calls signUpAction with provided email and password", async () => {
      (signUpAction as any).mockResolvedValue({ success: false });
      (getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@user.com", "mypassword");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@user.com", "mypassword");
    });

    test("does not redirect on failed sign-up", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email taken" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("user@example.com", "pass");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("on success with anon work: creates project, clears, and redirects", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Build something" }],
        fileSystemData: { "/index.tsx": { content: "export default () => <div />" } },
      };
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "new-anon-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@user.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-anon-proj");
    });

    test("on success with no anon work and no projects: creates new project", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@user.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/brand-new");
    });
  });
});
