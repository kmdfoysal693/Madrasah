import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type { SiteCmsData } from '../data/cmsTypes';
import { DEFAULT_CMS_DATA } from '../data/defaultCmsSeed';
import type { AdmissionSubmission, Department } from '../data/madrasaData';
import type { Language } from '../data/madrasaTranslations';
import { AdminDashboard } from './AdminDashboard';
import { LanguageToggle } from './LanguageToggle';
import { ReceiptModal } from './ReceiptModal';

function broadcastCmsUpdate() {
  try {
    localStorage.setItem('madrasa_cms_updated_at', String(Date.now()));
  } catch {
    // ignore storage errors
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('madrasa_cms_sync');
      channel.postMessage({ type: 'cms-updated', ts: Date.now() });
      channel.close();
    }
  } catch {
    // ignore BroadcastChannel errors
  }
}

export function StandaloneAdminApp() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('madrasa_lang');
      return saved === 'en' ? 'en' : 'bn';
    } catch {
      return 'bn';
    }
  });

  const [cmsData, setCmsData] = useState<SiteCmsData>(DEFAULT_CMS_DATA);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('madrasa_admin_token');
    } catch {
      return null;
    }
  });
  const [adminUsername, setAdminUsername] = useState('admin');
  const [authChecking, setAuthChecking] = useState(Boolean(adminToken));
  const skipNextMeRef = useRef(false);

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Receipt modal state for viewing/printing student application receipts
  const [receiptSubmission, setReceiptSubmission] = useState<AdmissionSubmission | null>(null);

  const isEn = lang === 'en';

  useEffect(() => {
    try {
      localStorage.setItem('madrasa_lang', lang);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = lang;
    const brandShort = isEn
      ? cmsData.siteSettings.brandShortEn || 'Admin CMS'
      : cmsData.siteSettings.brandShortBn || 'অ্যাডমিন CMS';
    document.title = isEn
      ? `${brandShort} — Admin Dashboard (CMS)`
      : `${brandShort} — অ্যাডমিন ড্যাশবোর্ড (CMS)`;
  }, [lang, isEn, cmsData.siteSettings.brandShortBn, cmsData.siteSettings.brandShortEn]);

  const loadCms = useCallback(async () => {
    try {
      const res = await fetch('/api/cms');
      if (!res.ok) return;
      const data = (await res.json()) as { cms?: SiteCmsData };
      if (data.cms) {
        setCmsData(data.cms);
      }
    } catch {
      // keep default fallback if server temporarily unreachable
    }
  }, []);

  useEffect(() => {
    void loadCms();
  }, [loadCms]);

  useEffect(() => {
    if (!adminToken) {
      setAuthChecking(false);
      return;
    }
    if (skipNextMeRef.current) {
      skipNextMeRef.current = false;
      setAuthChecking(false);
      return;
    }
    let cancelled = false;
    setAuthChecking(true);
    fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Unauthorized'))))
      .then((data: { admin?: { username: string } }) => {
        if (!cancelled && data.admin) {
          setAdminUsername(data.admin.username);
        }
      })
      .catch(() => {
        if (!cancelled) {
          try {
            localStorage.removeItem('madrasa_admin_token');
          } catch {
            // ignore
          }
          setAdminToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');

    if (!username.trim()) {
      setLoginError(isEn ? 'Please enter the admin username.' : 'অ্যাডমিন ইউজারনেম লিখুন।');
      return;
    }
    if (!password) {
      setLoginError(isEn ? 'Please enter the admin password.' : 'অ্যাডমিন পাসওয়ার্ড লিখুন।');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as {
        token?: string;
        admin?: { username: string };
        error?: string;
      };
      if (!res.ok || !data.token || !data.admin) {
        setLoginError(
          data.error ??
            (isEn ? 'Invalid admin credentials.' : 'অ্যাডমিন ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।'),
        );
        return;
      }
      try {
        localStorage.setItem('madrasa_admin_token', data.token);
      } catch {
        // ignore storage errors
      }
      skipNextMeRef.current = true;
      setAdminToken(data.token);
      setAdminUsername(data.admin.username);
      setPassword('');
      void loadCms();
    } catch {
      setLoginError(
        isEn
          ? 'Could not connect to backend server.'
          : 'ব্যাকএন্ড সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('madrasa_admin_token');
    } catch {
      // ignore storage errors
    }
    setAdminToken(null);
    setReceiptSubmission(null);
  }, []);

  const handleCmsUpdated = useCallback((nextCms: SiteCmsData) => {
    setCmsData(nextCms);
    broadcastCmsUpdate();
  }, []);

  const activeDepartments: Department[] = useMemo(
    () =>
      cmsData.departments.map((d) => ({
        id: d.id,
        code: isEn ? d.codeEn : d.codeBn,
        name: isEn ? d.nameEn : d.nameBn,
        subtitle: isEn ? d.subtitleEn : d.subtitleBn,
        duration: isEn ? d.durationEn : d.durationBn,
        ageGroup: isEn ? d.ageGroupEn : d.ageGroupBn,
        description: isEn ? d.descriptionEn : d.descriptionBn,
        highlights: isEn ? d.highlightsEn : d.highlightsBn,
        classes: isEn ? d.classesEn : d.classesBn,
      })),
    [cmsData.departments, isEn],
  );

  const activeBrandFull = isEn
    ? cmsData.siteSettings.brandFullEn
    : cmsData.siteSettings.brandFullBn;

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 text-sm text-[#475569]">
        {isEn ? 'Verifying admin session...' : 'অ্যাডমিন সেশন যাচাই করা হচ্ছে...'}
      </div>
    );
  }

  if (adminToken) {
    return (
      <>
        <AdminDashboard
          adminToken={adminToken}
          adminUsername={adminUsername}
          cmsData={cmsData}
          lang={lang}
          onChangeLang={setLang}
          onCmsUpdated={handleCmsUpdated}
          onViewAdmissionReceipt={(submission) => setReceiptSubmission(submission)}
          openSiteInNewTab
          onLogout={handleLogout}
        />

        <ReceiptModal
          submission={receiptSubmission}
          departments={activeDepartments}
          brandFull={activeBrandFull}
          lang={lang}
          onClose={() => setReceiptSubmission(null)}
          onNewApplication={() => setReceiptSubmission(null)}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#065F46] text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-[#0F172A] sm:text-base">
                {isEn ? 'Standalone Admin CMS' : 'স্বতন্ত্র অ্যাডমিন কন্ট্রোল প্যানেল'}
              </p>
              <p className="text-xs text-[#475569]">
                {isEn
                  ? cmsData.siteSettings.brandShortEn
                  : cmsData.siteSettings.brandShortBn}
              </p>
            </div>
          </div>

          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-5">
            <h1 className="font-serif text-xl font-bold text-[#0F172A]">
              {isEn ? 'Admin Backend Login' : 'অ্যাডমিন ব্যাকএন্ড লগইন'}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-[#475569]">
              {isEn
                ? 'Changes saved here are stored in the backend and reflected on the main website.'
                : 'এখান থেকে করা সকল পরিবর্তন ব্যাকএন্ডে সেভ থাকবে এবং মূল ওয়েবসাইটে তাৎক্ষণিকভাবে প্রদর্শিত হবে।'}
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 p-6" noValidate>
            <div className="rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3.5 py-2.5 text-xs text-[#065F46]">
              <p className="font-semibold">
                {isEn ? 'Default Admin Access:' : 'ডিফল্ট অ্যাডমিন লগইন তথ্য:'}
              </p>
              <p className="mt-0.5 tabular-nums">
                {isEn ? 'Username:' : 'ইউজারনেম:'}{' '}
                <span className="font-mono font-bold">admin</span> ·{' '}
                {isEn ? 'Password:' : 'পাসওয়ার্ড:'}{' '}
                <span className="font-mono font-bold">madrasa1448</span>
              </p>
            </div>

            {loginError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {loginError}
              </div>
            )}

            <div>
              <label
                htmlFor="standalone-admin-username"
                className="block text-sm font-medium text-[#0F172A]"
              >
                {isEn ? 'Admin Username' : 'অ্যাডমিন ইউজারনেম'}
              </label>
              <input
                id="standalone-admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
              />
            </div>

            <div>
              <label
                htmlFor="standalone-admin-password"
                className="block text-sm font-medium text-[#0F172A]"
              >
                {isEn ? 'Password' : 'পাসওয়ার্ড'}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="standalone-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 pr-10 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-[#475569] hover:text-[#0F172A]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-60"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>
                {loginLoading
                  ? isEn
                    ? 'Signing in...'
                    : 'যাচাই করা হচ্ছে...'
                  : isEn
                    ? 'Enter Admin Dashboard'
                    : 'অ্যাডমিন ড্যাশবোর্ডে প্রবেশ করুন'}
              </span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
