import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export const Panel = ({
  title,
  actions,
  children,
  contentClassName = "p-4",
}: PanelProps) => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border">
    <div className="flex shrink-0 items-center justify-between border-b p-2">
      <span className="truncate px-2 text-sm font-medium">{title}</span>
      {actions && <div className="flex gap-1">{actions}</div>}
    </div>
    <div className={`min-h-0 flex-1 overflow-auto ${contentClassName}`}>
      {children}
    </div>
  </div>
);
