"use client";

import { Loader2, FilePlus, FilePen, FileSearch, FileX, FolderInput } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolInvocation } from "ai";

interface ToolLabel {
  label: string;
  Icon: LucideIcon;
}

function basename(path: string): string {
  return path?.split("/").pop() ?? path;
}

export function getToolLabel(toolName: string, args: Record<string, unknown>): ToolLabel {
  if (toolName === "str_replace_editor") {
    const command = args.command as string;
    const file = basename(args.path as string);

    switch (command) {
      case "create":
        return { label: `Creating ${file}`, Icon: FilePlus };
      case "str_replace":
      case "insert":
        return { label: `Editing ${file}`, Icon: FilePen };
      case "view":
        return { label: `Reading ${file}`, Icon: FileSearch };
      default:
        return { label: `Working on ${file}`, Icon: FilePen };
    }
  }

  if (toolName === "file_manager") {
    const command = args.command as string;
    const file = basename(args.path as string);
    const newFile = basename(args.new_path as string);

    switch (command) {
      case "rename":
        return { label: `Renaming ${file} → ${newFile}`, Icon: FolderInput };
      case "delete":
        return { label: `Deleting ${file}`, Icon: FileX };
    }
  }

  return { label: toolName, Icon: FilePen };
}

interface ToolCallBadgeProps {
  tool: ToolInvocation;
}

export function ToolCallBadge({ tool }: ToolCallBadgeProps) {
  const done = tool.state === "result";
  const { label, Icon } = getToolLabel(tool.toolName, (tool.args ?? {}) as Record<string, unknown>);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {done ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600 flex-shrink-0" />
      )}
      <Icon className="w-3 h-3 text-neutral-500 flex-shrink-0" />
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
