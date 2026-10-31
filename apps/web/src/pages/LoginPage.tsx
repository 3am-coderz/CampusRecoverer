import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../kernel/auth-context';
import { FormInput } from '../components/FormInput';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setSubmitError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-xl mb-3">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
        <p className="text-xs text-slate-500 mt-1">
          Access your claims, reported items, or security desk
        </p>
      </div>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Campus Email"
          type="email"
          name="email"
          placeholder="student@campus.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />

        <FormInput
          label="Password"
          type="password"
          name="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-blue-600 font-semibold hover:underline">
          Create an account
        </Link>
      </div>

      {/* Demo Credentials Helper */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
        <p className="font-semibold text-slate-700 mb-2">Quick Sign-In Test Accounts:</p>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => handleQuickLogin('student@campus.edu', 'password123')}
            className="w-full text-left px-2.5 py-1.5 bg-white border border-slate-200 rounded hover:border-blue-400 text-slate-700 flex justify-between items-center transition"
          >
            <span>Student Claimant</span>
            <span className="text-[10px] text-blue-600 font-mono">student@campus.edu</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin('finder@campus.edu', 'password123')}
            className="w-full text-left px-2.5 py-1.5 bg-white border border-slate-200 rounded hover:border-blue-400 text-slate-700 flex justify-between items-center transition"
          >
            <span>Finder User</span>
            <span className="text-[10px] text-blue-600 font-mono">finder@campus.edu</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin('security@campus.edu', 'password123')}
            className="w-full text-left px-2.5 py-1.5 bg-white border border-slate-200 rounded hover:border-blue-400 text-slate-700 flex justify-between items-center transition"
          >
            <span>Security Desk Officer</span>
            <span className="text-[10px] text-purple-600 font-mono">security@campus.edu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
