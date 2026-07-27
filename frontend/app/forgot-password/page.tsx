'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordPage() {
  const { push } = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
    try {
      // Call the forgot password endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        throw new Error(text || 'Invalid response from server');
      }

      if (!response.ok) {
        let errorMessage = 'Failed to send reset link';
        if (data && typeof data === 'object') {
          errorMessage = data.detail || data.message || errorMessage;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
        throw new Error(errorMessage);
      }

      setMessage(data.message || 'If the email exists, a reset link has been sent.');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
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
          {/* We'll reuse the GraphIllustration from login page, but for simplicity, we can omit or define a simple one */}
          <div className="h-full flex items-center justify-center">
            <p className="text-white text-center">Forgot your password? Enter your email to receive a reset link.</p>
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
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.16em] mb-3">FORGOT PASSWORD</p>
          <h2 className="text-3xl font-bold text-foreground mb-3 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Reset your password
          </h2>
          <p className="text-sm text-text-muted mb-8">Enter your email address below to receive a password reset link.</p>

          {message && <p className="text-xs font-medium text-success bg-success-light border border-success/20 px-3 py-2 rounded-lg">{message}</p>}
          {error && <p className="text-xs font-medium text-danger bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                placeholder="you@institute.org"
                required
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-3 border border-border-med rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-text-dim text-foreground"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 mt-1 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
              style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Sending…' : 'Send reset link'}
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