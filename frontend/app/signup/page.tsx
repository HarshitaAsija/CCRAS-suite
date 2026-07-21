'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function GraphIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 520 380" fill="none">
      {[
        [80,60,180,130],[80,60,55,180],[180,130,310,75],[180,130,340,195],
        [180,130,195,275],[310,75,390,148],[55,180,95,278],[340,195,390,148],
        [340,195,298,298],[195,275,298,298],[95,278,195,275],
        [310,75,238,35],[390,148,430,95],[55,180,18,238],
      ].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth="1.2"/>
      ))}
      <circle cx="298" cy="220" r="50" stroke="#FF6B4A" strokeWidth="1.5" strokeDasharray="5 4" fill="rgba(255,107,74,0.1)"/>
      <text x="298" y="285" textAnchor="middle" fontSize="10" fontWeight="600" fill="#FF6B4A" letterSpacing="0.12em">UNSTUDIED</text>
      {[[80,60,9],[310,75,8],[55,180,8],[390,148,7],[95,278,8],[195,275,7],[298,298,7],[238,35,6],[430,95,5]].map(([cx,cy,r],i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.8)" opacity={i < 6 ? 0.9 : 0.5}/>
      ))}
      <circle cx="298" cy="220" r="10" fill="#FF6B4A" opacity="0.95"/>
      <circle cx="180" cy="130" r="13" fill="white" opacity="0.95"/>
    </svg>
  );
}

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signup({ name, email, password });
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen">
      {/* LEFT — hero panel */}
      <div className="hidden lg:flex w-1/2 flex-col p-12 bg-primary relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-auto">
          
          <span className="text-white font-semibold text-sm tracking-wide">CCRAS RESEARCH INTELLIGENCE SUITE</span>
        </div>
        <div className="mb-8">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.16em] mb-4">DISCOVER MODULE</p>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            Every map of knowledge<br />has an empty corner.
          </h1>
          <p className="text-white/60 text-base">That corner is where your next paper begins.</p>
        </div>
        <div className="bg-white/10 border border-white/15 rounded-2xl p-6" style={{ height: 320 }}>
          <GraphIllustration />
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="lg:hidden flex items-center gap-2 mb-8 self-start">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary text-white text-sm font-bold">R</div>
          <span className="font-semibold text-foreground text-sm">RISHI-AI</span>
        </div>

        <div className="w-full max-w-sm">
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.16em] mb-3">GET STARTED</p>
          <h2 className="text-3xl font-bold text-foreground mb-3 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Join CCRAS Research Intelligence Suite
          </h2>
          <p className="text-sm text-text-muted mb-8">Free for CCRAS researchers. Start finding gaps today.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {[
              { label: 'Full name', type: 'text', value: name, set: setName, placeholder: 'Dr. Priya Sharma' },
              { label: 'Email', type: 'email', value: email, set: setEmail, placeholder: 'you@ccras.gov.in' },
              { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: '••••••••' },
            ].map((f, i) => (
              <div key={i}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{f.label}</label>
                <input
                  type={f.type} value={f.value} placeholder={f.placeholder} required
                  onChange={e => f.set(e.target.value)}
                  className="w-full h-11 px-3 border border-border-med rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-text-dim text-foreground"
                />
              </div>
            ))}
            {error && <p className="text-xs font-medium text-danger bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 mt-1 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
              style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-text-muted text-center mt-6">
            Have an account?{' '}
            <Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}