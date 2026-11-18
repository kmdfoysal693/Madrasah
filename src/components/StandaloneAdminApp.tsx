import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { ChevronDown, Cloud, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type { SiteCmsData } from '../data/cmsTypes';
import { DEFAULT_CMS_DATA } from '../data/defaultCmsSeed';
import type { AdmissionSubmission, Department } from '../data/madrasaData';
import type { Language } from '../data/madrasaTranslations';
import { auth, googleProvider } from '../firebase';
import { seedCloudCmsIfEmpty, subscribeToCloudCms } from '../lib/firestoreCms';
import { AdminDashboard } from './AdminDashboard';
import { LanguageToggle } from './LanguageToggle';
import { ReceiptModal } from './ReceiptModal';

function broadcastCmsUpdate(nextCms?: SiteCmsData) {
  try {
    localStorage.setItem('madrasa_cms_updated_at', String(Date.now()));
  } catch {
    // ignore storage errors
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('madrasa_cms_sync');
      channel.postMessage({ type: 'cms-updated', ts: Date.now(), cms: nextCms });
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
  const cmsDataRef = useRef<SiteCmsData>(cmsData);
  cmsDataRef.current = cmsData;
  const hasCloudCmsRef = useRef(false);
  const cloudSeedCheckedRef = useRef(false);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

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

  // Login UI state
  const [showLegacyLogin, setShowLegacyLogin] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
    if (hasCloudCmsRef.current) return;
    try {
      const res = await fetch('/api/cms', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { cms?: SiteCmsData };
      if (data.cms && !hasCloudCmsRef.current) {
        setCmsData(data.cms);
      }
    } catch {
      // keep default fallback if server temporarily unreachable
    }
  }, []);

  useEffect(() => {
    void loadCms();
    let unsubscribeCloud: (() => void) | null = null;
    try {
      unsubscribeCloud = subscribeToCloudCms((cloudCms) => {
        hasCloudCmsRef.current = true;
        setCmsData(cloudCms);
      });
    } catch {
      unsubscribeCloud = null;
    }

    let eventSource: EventSource | null = null;
    try {
      if (typeof EventSource !== 'undefined') {
        eventSource = new EventSource('/api/cms/stream');
        const handleSseCms = (evt: MessageEvent<string>) => {
          if (hasCloudCmsRef.current) return;
          try {
            const parsed = JSON.parse(evt.data) as { cms?: SiteCmsData };
            if (parsed.cms) {
              setCmsData(parsed.cms);
            }
          } catch {
            // ignore malformed payload
          }
        };
        eventSource.addEventListener('cms-updated', handleSseCms as EventListener);
      }
    } catch {
      eventSource = null;
    }
    return () => {
      unsubscribeCloud?.();
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [loadCms]);

  const ensureCloudSeeded = useCallback(async () => {
    if (cloudSeedCheckedRef.current) return;
    cloudSeedCheckedRef.current = true;
    let seedSource = cmsDataRef.current;
    try {
      const res = await fetch('/api/cms', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { cms?: SiteCmsData };
        if (data.cms) {
          seedSource = data.cms;
        }
      }
    } catch {
      // ignore if local /api/cms unavailable (e.g. cold serverless)
    }
    await seedCloudCmsIfEmpty(seedSource).catch(() => {
      // Non-admin user or rules denial will surface cleanly when editing
    });
  }, []);

  // Listen to Firebase Auth state for Cloud Firestore Admin Access
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setFirebaseReady(true);
      if (user) {
        void ensureCloudSeeded();
      } else {
        cloudSeedCheckedRef.current = false;
      }
    });
    return () => unsub();
  }, [ensureCloudSeeded]);

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

  const handleGoogleAdminSignIn = useCallback(async () => {
    setLoginError('');
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await ensureCloudSeeded();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setLoginError(
          isEn
            ? `This domain (${host}) needs to be added to Firebase Authentication -> Authorized Domains in Firebase Console, or log in from the AI Studio Admin URL (changes still sync live to Vercel!).`
            : `এই ডোমেইনটি (${host}) Firebase Console-এর Authentication -> Authorized Domains-এ যোগ করতে হবে, অথবা AI Studio অ্যাডমিন থেকে লগইন করুন (সেখান থেকে পরিবর্তন করলেও Vercel-এ সাথে সাথে আপডেট হবে)।`,
        );
      } else if (msg.includes('auth/popup-closed-by-user')) {
        setLoginError(
          isEn ? 'Google sign-in popup was closed.' : 'গুগল লগইন পপআপ বন্ধ করা হয়েছে। আবার চেষ্টা করুন।',
        );
      } else {
        setLoginError(
          isEn
            ? 'Google sign-in failed. Please verify your admin email.'
            : 'গুগল লগইন সম্পন্ন হয়নি। আপনার অনুমোদিত অ্যাডমিন ইমেইল দিয়ে চেষ্টা করুন।',
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [ensureCloudSeeded, isEn]);

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
    void signOut(auth).catch(() => {});
    setAdminToken(null);
    setReceiptSubmission(null);
  }, []);

  const handleCmsUpdated = useCallback((nextCms: SiteCmsData) => {
    setCmsData(nextCms);
    broadcastCmsUpdate(nextCms);
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

  if (!firebaseReady || authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 text-sm text-[#475569]">
        {isEn ? 'Verifying admin session...' : 'অ্যাডমিন সেশন যাচাই করা হচ্ছে...'}
      </div>
    );
  }

  const isAuthenticated = Boolean(firebaseUser) || Boolean(adminToken);

  if (isAuthenticated) {
    return (
      <>
        <AdminDashboard
          adminToken={adminToken ?? 'firebase-cloud-session'}
          adminUsername={firebaseUser?.email ?? adminUsername}
          firebaseAdminEmail={firebaseUser?.email ?? null}
          cmsData={cmsData}
          lang={lang}
          onChangeLang={setLang}
          onCmsUpdated={handleCmsUpdated}
          onConnectCloudSync={handleGoogleAdminSignIn}
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
                ? 'Sign in with Google to save changes directly to Cloud Database — updates appear live on Vercel & all devices.'
                : 'Google দিয়ে লগইন করলে আপনার সকল পরিবর্তন ক্লাউড ডেটাবেসে সেভ হবে এবং Vercel সহ মূল ওয়েবসাইটে সাথে সাথে পরিবর্তন হবে।'}
            </p>
          </div>

          <div className="space-y-4 p-6">
            {loginError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed font-medium text-red-700"
              >
                {loginError}
              </div>
            )}

            <button
              type="button"
              disabled={googleLoading}
              onClick={handleGoogleAdminSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-60"
            >
              <Cloud className="h-4 w-4" aria-hidden="true" />
              <span>
                {googleLoading
                  ? isEn
                    ? 'Connecting Google Cloud Sync...'
                    : 'ক্লাউড সিঙ্ক চালু হচ্ছে...'
                  : isEn
                    ? 'Sign in with Google (Vercel Cloud Sync)'
                    : 'Google দিয়ে লগইন করুন (Vercel লাইভ সিঙ্ক)'}
              </span>
            </button>

            <div className="rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3.5 py-2.5 text-xs leading-relaxed text-[#065F46]">
              <p className="font-semibold">
                {isEn ? 'Live Vercel Synchronization' : 'Vercel ও মূল ওয়েবসাইটে লাইভ সিঙ্ক'}
              </p>
              <p className="mt-0.5">
                {isEn
                  ? 'All edits made after Google login persist in Cloud Firestore and update Vercel automatically without redeploying.'
                  : 'Google লগইন করে পরিবর্তন করলে তা ক্লাউড ডেটাবেসে স্থায়ীভাবে সেভ থাকবে এবং আলাদাভাবে রি-ডিপ্লয় ছাড়াই Vercel-এ আপডেট হবে।'}
              </p>
            </div>

            <div className="border-t border-[#E2E8F0] pt-3">
              <button
                type="button"
                onClick={() => setShowLegacyLogin((prev) => !prev)}
                className="flex w-full items-center justify-between text-xs font-medium text-[#475569] hover:text-[#0F172A]"
              >
                <span>
                  {isEn
                    ? 'Or sign in with local admin password'
                    : 'অথবা লোকাল পাসওয়ার্ড দিয়ে প্রবেশ করুন'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showLegacyLogin ? 'rotate-180' : ''}`}
                />
              </button>

              {showLegacyLogin && (
                <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3" noValidate>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-[#475569]">
                    {isEn ? 'Default:' : 'ডিফল্ট:'}{' '}
                    <span className="font-mono font-semibold text-[#0F172A]">admin</span> /{' '}
                    <span className="font-mono font-semibold text-[#0F172A]">madrasa1448</span>
                  </div>

                  <div>
                    <label
                      htmlFor="standalone-admin-username"
                      className="block text-xs font-medium text-[#0F172A]"
                    >
                      {isEn ? 'Admin Username' : 'অ্যাডমিন ইউজারনেম'}
                    </label>
                    <input
                      id="standalone-admin-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="standalone-admin-password"
                      className="block text-xs font-medium text-[#0F172A]"
                    >
                      {isEn ? 'Password' : 'পাসওয়ার্ড'}
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="standalone-admin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 pr-10 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[#475569] hover:text-[#0F172A]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {loginLoading
                        ? isEn
                          ? 'Signing in...'
                          : 'যাচাই করা হচ্ছে...'
                        : isEn
                          ? 'Local Admin Sign In'
                          : 'লোকাল লগইন'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
