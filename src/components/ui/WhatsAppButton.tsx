"use client";

import { useState, useEffect } from "react";

const WHATSAPP_NUMBER = "14375662773"; // Replace with client's actual number
const WHATSAPP_MESSAGE = encodeURIComponent("Hello Arade, I would like to make an enquiry.");

export default function WhatsAppButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show button after a short delay to avoid covering content on load
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Arade on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200"
    >
      <svg
        viewBox="0 0 32 32"
        fill="white"
        className="w-7 h-7"
        aria-hidden="true"
      >
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.132 6.744 3.058 9.374L1.054 31.25l6.118-1.98C9.66 31.156 12.728 32 16.004 32 24.826 32 32 24.822 32 16S24.826 0 16.004 0zm9.334 22.608c-.39 1.096-1.932 2.012-3.16 2.27-.84.18-1.936.322-5.628-1.21-4.726-1.964-7.762-6.784-8-7.1-.23-.316-1.9-2.53-1.9-4.826s1.2-3.42 1.628-3.89c.39-.428.924-.57 1.23-.57.31 0 .616.002.886.016.28.012.654-.106.888.676.236.8.804 2.77.872 2.97.07.2.116.43.024.694-.09.264-.136.428-.27.66-.134.232-.282.518-.402.694-.134.196-.274.408-.118.636.156.228.692 1.14 1.486 1.846 1.02.908 1.882 1.19 2.146 1.324.264.134.42.112.576-.068.156-.18.664-.774.84-.976.176-.202.352-.168.594-.1.242.068 1.534.724 1.798.856.264.132.44.198.504.308.064.11.064.632-.326 1.728z" />
      </svg>
    </a>
  );
}
