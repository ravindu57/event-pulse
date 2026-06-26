'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isDemoMode } from '@/lib/demo-data';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const demoMode = isDemoMode();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (demoMode) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setError('Check your email for a confirmation link!');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    if (demoMode) {
      router.push('/dashboard');
      router.refresh();
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-tertiary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined fill-icon text-on-primary text-[28px]">bolt</span>
          </div>
          <h1 className="font-geist text-[32px] font-black text-on-surface leading-tight">EventPulse</h1>
          <p className="text-body-md text-secondary mt-1">AI-powered event progress tracking</p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-outline-variant">
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={cn(
                  'flex-1 py-3.5 text-label-md font-semibold transition-all',
                  mode === m
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
                )}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Google OAuth */}
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-surface border border-outline-variant rounded-xl text-label-md font-medium text-on-surface hover:bg-surface-container-low transition-colors mb-5 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-outline-variant"></div>
              <span className="text-label-sm text-secondary">or with email</span>
              <div className="flex-1 h-px bg-outline-variant"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-label-md font-medium text-on-surface mb-2">Email address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="you@event.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-md font-medium text-on-surface mb-2">Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <div className={cn(
                  'p-3 rounded-xl text-body-sm flex items-start gap-2',
                  error.includes('Check your email')
                    ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                    : 'bg-error-container text-on-error-container border border-error/20'
                )}>
                  <span className="material-symbols-outlined fill-icon text-[16px] mt-0.5 flex-shrink-0">
                    {error.includes('Check your email') ? 'mail' : 'error'}
                  </span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 bg-primary text-on-primary rounded-xl text-label-md font-semibold hover:bg-surface-tint transition-colors btn-tactile shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            {mode === 'login' && (
              <p className="text-center text-label-sm text-secondary mt-4">
                <button className="text-primary hover:underline">Forgot password?</button>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-label-sm text-secondary mt-6">
          By signing in, you agree to EventPulse&apos;s{' '}
          <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
        </p>
      </div>
    </div>
  );
}
