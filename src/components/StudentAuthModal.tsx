import { useEffect, useState, type FormEvent } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Eye, EyeOff, GraduationCap, Lock, Mail, Phone, User, Users, X } from 'lucide-react';
import type { StudentUser } from '../data/studentPortalData';
import { isValidBdMobile, normalizeMobileNumber } from '../data/madrasaData';
import { UI_COPY, type Language } from '../data/madrasaTranslations';
import { auth, googleAuthProvider, setInMemoryFirebaseToken } from '../lib/firebase';

interface StudentAuthModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  onAuthSuccess: (token: string, student: StudentUser) => void;
}

type AuthTab = 'login' | 'register';

export function StudentAuthModal({
  isOpen,
  lang,
  onClose,
  onAuthSuccess,
}: StudentAuthModalProps) {
  const copy = UI_COPY[lang];
  const a = copy.auth;

  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regFatherName, setRegFatherName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
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

  const safeReadJson = async <T,>(response: Response): Promise<T | null> => {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading) return;
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setInMemoryFirebaseToken(idToken);

      const response = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fatherName: regFatherName.trim() || undefined,
        }),
      });
      const data = await safeReadJson<{
        token?: string;
        student?: StudentUser;
        error?: string;
      }>(response);
      if (!response.ok || !data?.token || !data?.student) {
        setErrorMsg(data?.error ?? a.errGoogleFailed);
        return;
      }
      onAuthSuccess(data.token, data.student);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('');
      } else {
        setErrorMsg(a.errGoogleFailed);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');

    const cleanPhone = normalizeMobileNumber(loginPhone);
    if (!isValidBdMobile(cleanPhone)) {
      setErrorMsg(a.errPhone);
      return;
    }
    if (!loginPassword) {
      setErrorMsg(a.errPasswordEmpty);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: loginPassword }),
      });
      const data = await safeReadJson<{
        token?: string;
        student?: StudentUser;
        error?: string;
      }>(response);
      if (!response.ok || !data?.token || !data?.student) {
        setErrorMsg(data?.error ?? a.errLoginFailed);
        return;
      }
      onAuthSuccess(data.token, data.student);
      setLoginPassword('');
    } catch {
      setErrorMsg(a.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');

    const cleanPhone = normalizeMobileNumber(regPhone);
    const cleanEmail = regEmail.trim().toLowerCase();

    if (regName.trim().length < 2) {
      setErrorMsg(a.errName);
      return;
    }
    if (regFatherName.trim().length < 2) {
      setErrorMsg(a.errFatherName);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg(a.errEmail);
      return;
    }
    if (!isValidBdMobile(cleanPhone)) {
      setErrorMsg(a.errPhone);
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg(a.errPasswordShort);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg(a.errPasswordMismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          fatherName: regFatherName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          password: regPassword,
          confirmPassword: regConfirmPassword,
        }),
      });
      const data = await safeReadJson<{
        token?: string;
        student?: StudentUser;
        error?: string;
      }>(response);
      if (!response.ok || !data?.token || !data?.student) {
        setErrorMsg(data?.error ?? a.errRegFailed);
        return;
      }
      onAuthSuccess(data.token, data.student);
      setRegPassword('');
      setRegConfirmPassword('');
    } catch {
      setErrorMsg(a.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-auth-title"
    >
      <div
        className="relative mx-auto my-auto w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-5 w-5 text-[#065F46]" aria-hidden="true" />
            <h2 id="student-auth-title" className="font-serif text-lg font-bold text-[#0F172A]">
              {a.portalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label={copy.closeBtn}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Segmented Auth Tabs */}
          <div
            role="tablist"
            aria-label={a.portalTitle}
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
              {a.loginTab}
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
              {a.registerTab}
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
                  {a.mobileLabel}
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
                    placeholder={copy.placeholderMobile}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 tabular-nums focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-[#0F172A]"
                >
                  {a.passwordLabel}
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
                    placeholder={a.passwordPlaceholder}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-10 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A]"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
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
                disabled={loading || googleLoading}
                className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? a.loggingIn : a.loginBtn}
              </button>

              <div className="relative flex items-center py-1">
                <div className="grow border-t border-[#E2E8F0]" />
                <span className="mx-3 shrink-0 text-[11px] font-medium text-[#64748B]">
                  {a.orDivider}
                </span>
                <div className="grow border-t border-[#E2E8F0]" />
              </div>

              <button
                type="button"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#CBD5E1] bg-white px-5 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{googleLoading ? a.googleSigningIn : a.googleSignInBtn}</span>
              </button>

              <p className="text-center text-xs text-[#475569]">
                {a.noAccount}{' '}
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="font-semibold text-[#065F46] underline-offset-4 hover:underline"
                >
                  {a.goRegister}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} noValidate className="mt-5 space-y-3.5">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-[#0F172A]">
                  {a.nameLabel}
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
                    placeholder={a.namePlaceholder}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-father-name"
                  className="block text-sm font-medium text-[#0F172A]"
                >
                  {a.fatherNameLabel}
                </label>
                <div className="relative mt-1">
                  <Users
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-father-name"
                    type="text"
                    value={regFatherName}
                    onChange={(e) => setRegFatherName(e.target.value)}
                    placeholder={a.fatherNamePlaceholder}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-[#0F172A]">
                  {a.emailLabel}
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
                    placeholder={a.emailPlaceholder}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-[#0F172A]">
                  {a.phoneLabel}
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
                    placeholder={copy.placeholderMobile}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 tabular-nums focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-[#0F172A]">
                  {a.passwordLabel}
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
                    placeholder={a.regPasswordPlaceholder}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-10 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A]"
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
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
                  {a.confirmPasswordLabel}
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
                    placeholder={a.confirmPasswordPlaceholder}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2.5 pr-4 pl-10 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? a.registering : a.registerBtn}
              </button>

              <p className="text-center text-xs text-[#475569]">
                {a.haveAccount}{' '}
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="font-semibold text-[#065F46] underline-offset-4 hover:underline"
                >
                  {a.goLogin}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
