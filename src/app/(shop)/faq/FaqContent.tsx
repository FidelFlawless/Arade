"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { faqCategories } from "./faqData";
import BackButton from "@/components/ui/BackButton";
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
      >
        <span className="font-medium text-foreground pr-4">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-foreground/50 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {/* Answer is always rendered (hidden when collapsed) so the content
          exists in the server HTML for search engines. */}
      <div
        className={`pb-4 text-foreground/70 text-sm leading-relaxed ${
          isOpen ? "" : "hidden"
        }`}
      >
        {answer}
      </div>
    </div>
  );
}

export default function FaqContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-left"><BackButton href="/" label="Back to home" /></div>
          <HelpCircle className="w-12 h-12 text-primary mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-4xl lg:text-5xl font-serif text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-foreground/60 text-lg">
            Find answers to common questions about shopping with Arade.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="space-y-12">
          {faqCategories.map((category) => (
            <div key={category.title}>
              <h2 className="text-xl font-serif text-foreground mb-4">
                {category.title}
              </h2>
              <div className="bg-white border border-border rounded-xl p-6">
                {category.questions.map((item) => (
                  <FaqItem key={item.q} question={item.q} answer={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-12 text-center bg-muted/50 rounded-xl p-8">
          <h3 className="text-xl font-serif text-foreground mb-2">
            Still have questions?
          </h3>
          <p className="text-foreground/60 mb-4">
            Our support team is here to help.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
