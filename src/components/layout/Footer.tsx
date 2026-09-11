"use client";


import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { Facebook, Instagram, Twitter } from "lucide-react";

const footerLinks = {
  categories: [
    { label: "Beauty", href: "/beauty" },
    { label: "Skincare", href: "/skincare" },
    { label: "Hair", href: "/hair" },
    { label: "Fashion", href: "/fashion" },
    { label: "All Products", href: "/shop" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Shipping Policy", href: "/shipping" },
    { label: "Return Policy", href: "/returns" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
  ],
  support: [
    { label: "FAQ", href: "/faq" },
    { label: "Track Order", href: "/account/orders" },
  ],
};

export default function Footer() {
  
  return (
    <footer className="bg-[#2c1810] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Top section: Brand + Newsletter on left, links on right */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Brand + Newsletter */}
          <div className="lg:w-[35%] shrink-0">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-bold text-primary-light tracking-tight">
                {SITE_NAME}
              </span>
            </Link>
            <p className="mt-4 text-white/60 text-sm leading-relaxed">
              Your destination for beauty, skincare, hair and fashion.
              Curated products to elevate your everyday routine.
            </p>

            </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Shop
              </h3>
              <ul className="space-y-3">
                {footerLinks.categories.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/60 hover:text-white text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Company
              </h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/60 hover:text-white text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Support
              </h3>
              <ul className="space-y-3">
                {footerLinks.support.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/60 hover:text-white text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <a href="#" className="text-white/40 hover:text-white transition-colors" aria-label="Facebook">
                <Facebook className="w-6 h-6" aria-hidden="true" />
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram className="w-6 h-6" aria-hidden="true" />
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter className="w-6 h-6" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
