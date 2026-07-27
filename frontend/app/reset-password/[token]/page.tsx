'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    try {
      // Call the reset password endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        throw new Error(text || 'Invalid response from server');
      }

      if (!response.ok) {
        let errorMessage = 'Failed to reset password';
        if (data && typeof data === 'object') {
          errorMessage = data.detail || data.message || errorMessage;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
        throw new Error(errorMessage);
      }

      setMessage(data.message || 'Password has been reset successfully.');
      // Optionally, redirect to login after a delay
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    // If no token, redirect to login or show error
    router.push('/login');
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* LEFT — hero panel */}
      <div className="hidden lg:flex w-1/2 flex-col p-12 bg-primary relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-auto">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 text-white text-sm font-bold border border-white/20">R</div>
          <span className="text-white font-semibold text-sm tracking-wide">Research Intelligent suite</span>
        </div>
        <div className="mb-8">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.16em] mb-4">DISCOVER MODULE</p>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            Every map of knowledge<br />has an empty corner.
          </h1>
          <p className="text-white/60 text-base">That corner is where your next paper begins.</p>
        </div>
        <div className="bg-white/10 border border-white/15 rounded-2xl p-6" style={{ height: 320 }}>
          <div className="h-full flex items-center justify-center">
            <p className="text-white text-center">Enter your new password below.</p>
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8 self-start">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary text-white text-sm font-bold">R</div>
          <span className="font-semibold text-foreground text-sm">Research Intelligent Suite</span>
        </div>

        <div className="w-full max-w-sm">
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.16em] mb-3">RESET PASSWORD</p>
          <h2 className="text-3xl font-bold text-foreground mb-3 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Set a new password
          </h2>
          <p className="text-sm text-text-muted mb-8">Choose a strong password for your account.</p>

          {message && <p className="text-xs font-medium text-success bg-success-light border border-success/20 px-3 py-2 rounded-lg">{message}</p>}
          {error && <p className="text-xs font-medium text-danger bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">New Password</label>
              <input
                type="password"
                value={password}
                placeholder="Enter new password"
                required
                onChange={e => setPassword(e.target.value)}
                className="w-full h-11 px-3 border border-border-med rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-text-dim text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                placeholder="Confirm new password"
                required
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full h-11 px-3 border border-border-med rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-text-dim text-foreground"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 mt-1 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
              style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p className="text-sm text-text-muted text-center mt-6">
            Remember your password?{' '}
            <Link href="/login" className="text-primary font-bold hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}