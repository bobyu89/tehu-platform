import { redirect } from "next/navigation";

// 派單已整併至桌面主控台
export default function AdminDispatchRedirect() {
  redirect("/console/dispatch");
}
