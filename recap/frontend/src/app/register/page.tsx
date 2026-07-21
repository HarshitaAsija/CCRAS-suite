"use client";

// frontend/src/app/register/page.tsx
// Register page — connects to POST /api/auth/signup?email=&password=

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { registerUser } from "@/lib/auth";

// ─── Password strength helper ─────────────────────────────────────────────────
function getPasswordStrength(pwd: string): { label: string; color: string; width: string } {
  if (pwd.length === 0) return { label: "", color: "bg-white/10", width: "w-0" };
  if (pwd.length < 6)   return { label: "Too short", color: "bg-red-400", width: "w-1/4" };
  if (pwd.length < 8)   return { label: "Weak", color: "bg-amber-400", width: "w-2/4" };
  if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd))
                        return { label: "Fair", color: "bg-yellow-400", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-400", width: "w-full" };
}

export default function RegisterPage() {
  const router = useRouter();

  // ─── State ────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(""); // ← ADDED: Name field
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // ✅ FIX: Pass name parameter (default to "User" if not provided)
      await registerUser(email, password, name || "User", "PG-CCRAS");
      setSuccess(true);
      // Redirect to login after 2s
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#0b0b12] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-64 bg-violet-600/20 rounded-full blur-[100px]" />
        <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.08] p-10 text-center max-w-sm w-full backdrop-blur">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-300" />
          </div>
          <h2 className="text-xl font-bold text-white/90 mb-2">Account created!</h2>
          <p className="text-sm text-white/40">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
            Create your account
          </h1>
          <p className="text-sm text-white/40 mt-1.5">Join RECAP/KRITA Research Engine</p>
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

            {/* Name - ADDED */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-400/40 focus:border-violet-400/40 transition-colors placeholder:text-white/25"
                />
              </div>
            </div>

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
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
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
              {/* Strength bar */}
              {password && (
                <div className="mt-2">
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="text-[11px] text-white/30 mt-1">{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-white/[0.04] border rounded-lg text-white focus:outline-none focus:ring-1 transition-colors placeholder:text-white/25 ${
                    confirmPassword
                      ? passwordsMatch
                        ? "border-emerald-400/40 focus:ring-emerald-400/40"
                        : "border-red-400/40 focus:ring-red-400/40"
                      : "border-white/[0.08] focus:ring-violet-400/40 focus:border-violet-400/40"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[11px] text-red-300 mt-1">Passwords don't match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(167,139,250,0.35)]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0f0f18] px-3 text-xs text-white/30">
                Already have an account?
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="block w-full text-center py-2.5 rounded-lg border border-violet-400/30 text-sm font-medium text-violet-200 hover:bg-violet-500/10 transition-colors"
          >
            Sign in instead
          </Link>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          RECAP/KRITA — Research Engine for Categorization, Analysis &amp; Papers
        </p>
      </div>
    </div>
  );
}