import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, GraduationCap, Lock, Mail, Phone, User, X } from 'lucide-react';
import type { StudentUser } from '../data/studentPortalData';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (token: string, student: StudentUser) => void;
}

type AuthTab = 'login' | 'register';

export function StudentAuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
}: StudentAuthModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setErrorMsg('');
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');

    const cleanPhone = loginPhone.replace(/[\s-]/g, '').trim();
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('অনুগ্রহ করে পাসওয়ার্ড লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: loginPassword }),
      });
      const data = (await response.json()) as {
        token?: string;
        student?: StudentUser;
        error?: string;
      };
      if (!response.ok || !data.token || !data.student) {
        setErrorMsg(data.error ?? 'লগইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।');
        return;
      }
      onAuthSuccess(data.token, data.student);
      setLoginPassword('');
    } catch {
      setErrorMsg('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');

    const cleanPhone = regPhone.replace(/[\s-]/g, '').trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (regName.trim().length < 2) {
      setErrorMsg('অনুগ্রহ করে শিক্ষার্থীর পূর্ণ নাম লিখুন।');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('সঠিক ইমেইল ঠিকানা প্রদান করুন।');
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('পাসওয়ার্ড এবং নিশ্চিত পাসওয়ার্ড মিলছে না।');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          password: regPassword,
          confirmPassword: regConfirmPassword,
        }),
      });
      const data = (await response.json()) as {
        token?: string;
        student?: StudentUser;
        error?: string;
      };
      if (!response.ok || !data.token || !data.student) {
        setErrorMsg(data.error ?? 'রেজিস্ট্রেশন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।');
        return;
      }
      onAuthSuccess(data.token, data.student);
      setRegPassword('');
      setRegConfirmPassword('');
    } catch {
      setErrorMsg('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-auth-title"
    >
      <div
        className="relative my-8 w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-5 w-5 text-[#065F46]" aria-hidden="true" />
            <h2 id="student-auth-title" className="font-serif text-lg font-bold text-[#0F172A]">
              ছাত্র পোর্টাল
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label="বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Segmented Auth Tabs */}
          <div
            role="tablist"
            aria-label="লগইন ও রেজিস্ট্রেশন"
            className="grid grid-cols-2 gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'login'}
              onClick={() => switchTab('login')}
              className={`rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'login'
                  ? 'bg-white text-[#065F46] shadow-xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              ছাত্র লগইন
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              onClick={() => switchTab('register')}
              className={`rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'register'
                  ? 'bg-white text-[#065F46] shadow-xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              নতুন রেজিস্ট্রেশন
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label htmlFor="login-phone" className="block text-sm font-medium text-[#0F172A]">
                  মোবাইল নম্বর
                </label>
                <div className="relative mt-1.5">
                  <Phone
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 tabular-nums focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-[#0F172A]"
                >
                  পাসওয়ার্ড
                </label>
                <div className="relative mt-1.5">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="আপনার পাসওয়ার্ড লিখুন"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-10 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A]"
                    aria-label={showLoginPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন'}
              </button>

              <p className="text-center text-xs text-[#475569]">
                একাউন্ট না থাকলে{' '}
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="font-semibold text-[#065F46] underline-offset-4 hover:underline"
                >
                  নতুন রেজিস্ট্রেশন করুন
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} noValidate className="mt-5 space-y-3.5">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-[#0F172A]">
                  শিক্ষার্থীর নাম
                </label>
                <div className="relative mt-1">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="যেমন: মুহাম্মদ হাসান আলী"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-[#0F172A]">
                  ইমেইল ঠিকানা
                </label>
                <div className="relative mt-1">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-[#0F172A]">
                  ফোন নাম্বার
                </label>
                <div className="relative mt-1">
                  <Phone
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="numeric"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 tabular-nums focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-[#0F172A]">
                  পাসওয়ার্ড
                </label>
                <div className="relative mt-1">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-10 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A]"
                    aria-label={showRegPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showRegPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-confirm-password"
                  className="block text-sm font-medium text-[#0F172A]"
                >
                  নিশ্চিত পাসওয়ার্ড
                </label>
                <div className="relative mt-1">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-confirm-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'রেজিস্ট্রেশন হচ্ছে...' : 'রেজিস্ট্রেশন সম্পন্ন করুন'}
              </button>

              <p className="text-center text-xs text-[#475569]">
                ইতিমধ্যে একাউন্ট থাকলে{' '}
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="font-semibold text-[#065F46] underline-offset-4 hover:underline"
                >
                  লগইন করুন
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
