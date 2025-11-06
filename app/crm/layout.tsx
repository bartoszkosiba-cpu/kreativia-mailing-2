import { ReactNode } from "react";

export default function CRMLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "calc(100vh - 64px)" }}>
      {children}
    </div>
  );
}

