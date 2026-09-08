"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  name: string;
}

export default function ProductImageGallery({ images, name }: Props) {
  const [selected, setSelected] = useState(0);
  const allImages = images && images.length > 0 ? images : [];

  if (allImages.length === 0) {
    return (
      <div className="bg-muted rounded-2xl aspect-square flex items-center justify-center">
        <p className="text-foreground/30 text-lg">No Image Available</p>
      </div>
    );
  }

  function prev() {
    setSelected((s) => (s === 0 ? allImages.length - 1 : s - 1));
  }

  function next() {
    setSelected((s) => (s === allImages.length - 1 ? 0 : s + 1));
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative bg-muted rounded-2xl overflow-hidden aspect-square group">
        <img
          src={allImages[selected]}
          alt={`${name} - Image ${selected + 1}`}
          className="w-full h-full object-cover"
        />

        {/* Navigation arrows (only if more than 1 image) */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </>
        )}

        {/* Image counter */}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {selected + 1} / {allImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                i === selected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-foreground/20"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={img}
                alt={`${name} thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
