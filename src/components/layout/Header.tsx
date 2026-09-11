"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { ShoppingCart, User, Menu, X, Search, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import SearchPanel from "@/components/search/SearchPanel";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const { cartCount } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [userMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleMobileOutside = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleMobileOutside);
    return () => document.removeEventListener("pointerdown", handleMobileOutside);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.jpg"
              alt="Arade"
              className="h-8 w-8 lg:h-10 lg:w-auto object-contain rounded-xl"
            />
            <span className="text-xl lg:text-3xl font-bold text-primary tracking-tight">
              {SITE_NAME}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative font-medium transition-colors duration-200 pb-1 ${
                    isActive
                      ? "text-primary"
                      : "text-foreground/70 hover:text-primary"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 sm:p-2 text-foreground/60 hover:text-primary transition-colors"
              aria-label="Search products"
            >
              <Search className="w-5 h-5" />
            </button>

            <Link
              href="/cart"
              className="relative p-1.5 sm:p-2 text-foreground/60 hover:text-primary transition-colors"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {loading ? (
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
            ) : user ? (
              <>
                {profile?.role === "admin" && (
                  <Link
                    href="/admin"
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    Admin
                  </Link>
                )}
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 text-foreground/60 hover:text-primary transition-colors"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 hidden sm:block ${
                      userMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-border py-2 z-50">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground truncate">
                          {profile?.full_name || "Account"}
                        </p>
                        <p className="text-xs text-foreground/60 truncate">
                          {user.email}
                        </p>
                      </div>
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-primary"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/account/orders"
                        className="block px-4 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-primary"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/account/addresses"
                        className="block px-4 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-primary"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Saved Addresses
                      </Link>
                      {profile?.role === "admin" && (
                        <Link
                          href="/admin"
                          className="block px-4 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-primary"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <hr className="my-2 border-border" />
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Sign Out
                      </button>
                    </div>
                )}
              </div>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="hidden sm:flex items-center gap-2 btn-primary text-sm py-2 px-4"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-foreground/60 hover:text-primary transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div ref={mobileMenuRef} className="lg:hidden border-t border-border py-4">
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/70 hover:bg-muted hover:text-primary"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {!user && (
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-primary font-medium hover:bg-muted rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    <SearchPanel isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
