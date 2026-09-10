"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  CreditCard,
  Settings,
  Menu,
  X,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-foreground text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <span className="font-bold text-primary-light">Arade Admin</span>
        <div className="w-6" />
      </div>
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed left-0 top-0 h-full bg-foreground text-white z-40 transition-all duration-300 ${collapsed ? "w-16" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            {!collapsed && <Link href="/admin" className="text-lg font-bold text-primary-light">Arade Admin</Link>}
            <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block p-1 hover:bg-white/10 rounded">
              <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
          <nav className="flex-1 py-4 space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-primary/20 text-primary-light" : "text-white/60 hover:bg-white/10 hover:text-white"} ${collapsed ? "justify-center" : ""}`} title={collapsed ? item.label : undefined}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>;
            })}
          </nav>
          <div className="p-4 border-t border-white/10">
            {!collapsed && profile && <div className="mb-3"><p className="text-sm font-medium truncate">{profile.full_name}</p><p className="text-xs text-white/50 truncate">{profile.email}</p></div>}
            <div className="flex gap-2">
              <Link href="/" className={`p-2 hover:bg-white/10 rounded ${collapsed ? "w-full flex justify-center" : ""}`} title="Back to Store"><Package className="w-5 h-5" /></Link>
              <button onClick={signOut} className={`p-2 hover:bg-white/10 rounded text-red-400 ${collapsed ? "w-full flex justify-center" : ""}`} title="Sign Out"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <AuthProvider><div className="min-h-screen bg-muted/30"><AdminSidebar /><main className="lg:ml-64 pt-[58px] px-4 pb-4 lg:pt-8 lg:pl-8 lg:pr-8 lg:pb-8 transition-all duration-300">{children}</main></div></AuthProvider>;
}
