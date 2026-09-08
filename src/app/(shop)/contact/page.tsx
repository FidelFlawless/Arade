"use client";

import { useState, useEffect } from "react";
import { Mail, Phone, MapPin, Clock, Send, Loader2, CheckCircle } from "lucide-react";

interface Settings {
  store_email: string;
  store_phone: string;
  store_address: string;
  business_hours: string;
}

const defaultSettings: Settings = {
  store_email: "Fideliarufus35@gmail.com",
  store_phone: "+1 (437) 566-2773",
  store_address: "Ontario\nCanada",
  business_hours: "Mon - Fri: 9:00 AM - 6:00 PM EST\nSat: 10:00 AM - 4:00 PM EST\nSun: Closed",
};

export default function ContactPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          store_email: data.store_email || defaultSettings.store_email,
          store_phone: data.store_phone || defaultSettings.store_phone,
          store_address: data.store_address || defaultSettings.store_address,
          business_hours: data.business_hours || defaultSettings.business_hours,
        });
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid email address";
    if (!form.subject.trim()) newErrors.subject = "Subject is required";
    if (!form.message.trim()) newErrors.message = "Message is required";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const whatsappNumber = "14375662773";
    const msg = `Hello Arade,\n\nName: ${form.name}\nEmail: ${form.email}\n\nSubject: ${form.subject}\n\nMessage:\n${form.message}`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, "_blank");
    setSubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Get in Touch
        </h1>
        <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
          Have a question about our products? Need help with your order? We&apos;re
          here to help!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Contact info */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Contact Information
          </h2>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Email</p>
              <p className="text-foreground/60">{settings.store_email}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Phone</p>
              <p className="text-foreground/60">{settings.store_phone}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Address</p>
              <p className="text-foreground/60 whitespace-pre-line">{settings.store_address}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Business Hours</p>
              <p className="text-foreground/60 whitespace-pre-line">{settings.business_hours}</p>
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2">
          {submitted ? (
            <div className="card text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
              <h3 className="text-xl font-bold text-foreground mb-2">
                Message Sent via WhatsApp!
              </h3>
              <p className="text-foreground/60 mb-6">
                Thank you for reaching out. Your message has been sent to our WhatsApp. We&apos;ll get back to you shortly.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setForm({ name: "", email: "", subject: "", message: "" });
                }}
                className="btn-primary"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card">
              <h2 className="text-lg font-semibold text-foreground mb-6">
                Send a Message
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className={`input ${errors.name ? "border-red-500" : ""}`}
                      placeholder="John Doe"
                    />
                    {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      suppressHydrationWarning
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className={`input ${errors.email ? "border-red-500" : ""}`}
                      placeholder="john@example.com"
                    />
                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    className={`input ${errors.subject ? "border-red-500" : ""}`}
                    placeholder="How can we help?"
                  />
                  {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Message
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) =>
                      setForm({ ...form, message: e.target.value })
                    }
                    rows={5}
                    className={`input resize-none ${errors.message ? "border-red-500" : ""}`}
                    placeholder="Tell us more about your question or concern..."
                  />
                  {errors.message && <p className="text-xs text-red-600 mt-1">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
