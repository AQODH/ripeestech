import type { ReactNode } from "react";
import AdminAuthControls from "./auth-controls";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <AdminAuthControls />
      {children}
    </>
  );
}
