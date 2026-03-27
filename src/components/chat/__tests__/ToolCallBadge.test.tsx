import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

// --- getToolLabel unit tests ---

describe("getToolLabel", () => {
  describe("str_replace_editor", () => {
    test("create", () => {
      const { label } = getToolLabel("str_replace_editor", { command: "create", path: "src/components/Button.tsx" });
      expect(label).toBe("Creating Button.tsx");
    });

    test("str_replace", () => {
      const { label } = getToolLabel("str_replace_editor", { command: "str_replace", path: "src/components/Button.tsx" });
      expect(label).toBe("Editing Button.tsx");
    });

    test("insert", () => {
      const { label } = getToolLabel("str_replace_editor", { command: "insert", path: "src/App.tsx" });
      expect(label).toBe("Editing App.tsx");
    });

    test("view", () => {
      const { label } = getToolLabel("str_replace_editor", { command: "view", path: "src/index.ts" });
      expect(label).toBe("Reading index.ts");
    });

    test("unknown command falls back to Working on", () => {
      const { label } = getToolLabel("str_replace_editor", { command: "undo_edit", path: "src/App.tsx" });
      expect(label).toBe("Working on App.tsx");
    });
  });

  describe("file_manager", () => {
    test("rename", () => {
      const { label } = getToolLabel("file_manager", {
        command: "rename",
        path: "src/Old.tsx",
        new_path: "src/New.tsx",
      });
      expect(label).toBe("Renaming Old.tsx → New.tsx");
    });

    test("delete", () => {
      const { label } = getToolLabel("file_manager", { command: "delete", path: "src/Unused.tsx" });
      expect(label).toBe("Deleting Unused.tsx");
    });
  });

  test("unknown tool falls back to tool name", () => {
    const { label } = getToolLabel("some_unknown_tool", { command: "do_something" });
    expect(label).toBe("some_unknown_tool");
  });
});

// --- ToolCallBadge render tests ---

function makeInvocation(overrides: Partial<ToolInvocation> = {}): ToolInvocation {
  return {
    state: "call",
    toolCallId: "test-id",
    toolName: "str_replace_editor",
    args: { command: "create", path: "src/Button.tsx" },
    ...overrides,
  } as ToolInvocation;
}

describe("ToolCallBadge", () => {
  test("shows human-readable label for str_replace_editor create", () => {
    render(<ToolCallBadge tool={makeInvocation()} />);
    expect(screen.getByText("Creating Button.tsx")).toBeDefined();
  });

  test("shows spinner when not done", () => {
    const { container } = render(<ToolCallBadge tool={makeInvocation({ state: "call" })} />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  test("shows green dot when done", () => {
    const { container } = render(
      <ToolCallBadge tool={makeInvocation({ state: "result", result: "ok" } as any)} />
    );
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
    expect(container.querySelector(".animate-spin")).toBeFalsy();
  });

  test("shows label for file_manager rename", () => {
    render(
      <ToolCallBadge
        tool={makeInvocation({
          toolName: "file_manager",
          args: { command: "rename", path: "src/Old.tsx", new_path: "src/New.tsx" },
        })}
      />
    );
    expect(screen.getByText("Renaming Old.tsx → New.tsx")).toBeDefined();
  });

  test("shows label for file_manager delete", () => {
    render(
      <ToolCallBadge
        tool={makeInvocation({
          toolName: "file_manager",
          args: { command: "delete", path: "src/Unused.tsx" },
        })}
      />
    );
    expect(screen.getByText("Deleting Unused.tsx")).toBeDefined();
  });
});
