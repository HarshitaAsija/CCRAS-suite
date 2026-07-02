'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
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
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="px-12 py-4 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary text-white text-sm font-bold shadow-sm">
            R
          </div>
          <span className="font-sans font-semibold text-foreground text-sm">RISHI-AI</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-border-light p-10">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-2">Create account</h1>
          <p className="font-sans text-sm text-text-muted mb-8">Free for CCRAS researchers</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {[
              { label: 'Full name', type: 'text', value: name, set: setName, placeholder: 'Dr. Priya Sharma' },
              { label: 'Email', type: 'email', value: email, set: setEmail, placeholder: 'you@ccras.gov.in' },
              { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: '••••••••' },
            ].map((f, i) => (
              <div key={i}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{f.label}</label>
                <input 
                  type={f.type} 
                  value={f.value} 
                  placeholder={f.placeholder} 
                  required
                  onChange={e => f.set(e.target.value)} 
                  className="w-full h-11 px-3 border border-border-med rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-text-dim text-foreground" 
                />
              </div>
            ))}
            {error && <p className="text-xs font-medium text-danger bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 mt-1 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm" style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="font-sans text-sm text-text-muted text-center mt-6">
            Have an account?{' '}<Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
