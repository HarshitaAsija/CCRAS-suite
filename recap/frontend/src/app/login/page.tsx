"use client";

// frontend/src/app/login/page.tsx
// Login page — connects to POST /api/auth/login (OAuth2 form-data)

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { loginUser } from "@/lib/auth"; // ← REMOVED saveToken import

export default function LoginPage() {
  const router = useRouter();

  // ─── State ──────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // ✅ loginUser already saves the token and user_id
      await loginUser(email, password);
      // ✅ No need to call saveToken() again
      router.push("/dashboard"); // redirect to dashboard after login
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b0b12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient gradient glow — matches homepage hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-64 bg-violet-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-10 right-1/3 w-64 h-40 bg-fuchsia-600/10 rounded-full blur-[90px]" />
      {/* Background dot grid — matches homepage hero */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #a78bfa 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative w-full max-w-md">

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white via-violet-100 to-violet-300 bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-sm text-white/40 mt-1.5">Sign in to RECAP/KRITA</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-8 shadow-[0_0_40px_rgba(124,58,237,0.08)] backdrop-blur">

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-400/40 focus:border-violet-400/40 transition-colors placeholder:text-white/25"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-white/70">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-violet-300 hover:text-violet-200"
                  onClick={() => setError("Forgot password — not implemented yet")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-400/40 focus:border-violet-400/40 transition-colors placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(167,139,250,0.35)]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0f0f18] px-3 text-xs text-white/30">
                Don't have an account?
              </span>
            </div>
          </div>

          {/* Register link */}
          <Link
            href="/register"
            className="block w-full text-center py-2.5 rounded-lg border border-violet-400/30 text-sm font-medium text-violet-200 hover:bg-violet-500/10 transition-colors"
          >
            Create an account
          </Link>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          RECAP/KRITA — Research Engine for Categorization, Analysis &amp; Papers
        </p>
      </div>
    </div>
  );
}