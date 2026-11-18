import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cloud,
  ExternalLink,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Palette,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_ADMIN_TAB_LABELS,
  getCardRadiusClass,
  normalizeAdminConfig,
  resolveAdminTheme,
  type AdminDashboardConfig,
  type AdminTabId,
} from '../admin/adminConfig';
import type { AdminApiRequestFn, AdminPanelBaseProps } from '../admin/types';
import { AboutPanel } from '../admin/panels/AboutPanel';
import { AdmissionsPanel } from '../admin/panels/AdmissionsPanel';
import { BrandingPanel } from '../admin/panels/BrandingPanel';
import { CustomizePanel } from '../admin/panels/CustomizePanel';
import { DepartmentsPanel } from '../admin/panels/DepartmentsPanel';
import { GalleryPanel } from '../admin/panels/GalleryPanel';
import { HeroPanel } from '../admin/panels/HeroPanel';
import { NoticesPanel } from '../admin/panels/NoticesPanel';
import { OverviewPanel } from '../admin/panels/OverviewPanel';
import { SecurityPanel } from '../admin/panels/SecurityPanel';
import { TeachersPanel } from '../admin/panels/TeachersPanel';
import type {
  AboutSectionCms,
  AdmissionStatus,
  CmsDepartment,
  CmsGalleryItem,
  CmsNotice,
  CmsTeacherProfile,
  HeroSectionCms,
  NoticeStatus,
  SiteCmsData,
  SiteSettingsCms,
  StoredAdmissionRecord,
} from '../data/cmsTypes';
import type { AdmissionSubmission } from '../data/madrasaData';
import { formatDigits, type Language } from '../data/madrasaTranslations';
import {
  cloudDeleteAdmission,
  cloudDeleteDepartment,
  cloudDeleteGalleryItem,
  cloudDeleteNotice,
  cloudDeleteTeacher,
  cloudGetAdminUiConfig,
  cloudResetAdminUiConfig,
  cloudResetCmsDefaults,
  cloudSaveAboutSection,
  cloudSaveAdminUiConfig,
  cloudSaveHeroSection,
  cloudSaveSiteSettings,
  cloudSetNoticeStatus,
  cloudSubscribeAdmissions,
  cloudUpdateAdmissionStatus,
  cloudUpsertDepartment,
  cloudUpsertGalleryItem,
  cloudUpsertNotice,
  cloudUpsertTeacher,
  fetchCloudCmsSnapshot,
} from '../lib/firestoreCms';
import { LanguageToggle } from './LanguageToggle';

interface AdminDashboardProps {
  adminToken: string;
  adminUsername: string;
  firebaseAdminEmail?: string | null;
  cmsData: SiteCmsData;
  lang: Language;
  onChangeLang: (next: Language) => void;
  onCmsUpdated: (nextCms: SiteCmsData) => void;
  onConnectCloudSync?: () => Promise<void>;
  onViewAdmissionReceipt: (submission: AdmissionSubmission) => void;
  onCloseDashboard?: () => void;
  openSiteInNewTab?: boolean;
  onLogout: () => void;
}

const TAB_ICONS: Record<AdminTabId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  admissions: ClipboardList,
  branding: Building2,
  hero: ImageIcon,
  about: BookOpen,
  notices: FileText,
  departments: GraduationCap,
  gallery: ImageIcon,
  teachers: Users,
  customize: Palette,
  security: Lock,
};

export function AdminDashboard({
  adminToken,
  adminUsername,
  firebaseAdminEmail = null,
  cmsData,
  lang,
  onChangeLang,
  onCmsUpdated,
  onConnectCloudSync,
  onViewAdmissionReceipt,
  onCloseDashboard,
  openSiteInNewTab = false,
  onLogout,
}: AdminDashboardProps) {
  const isEn = lang === 'en';
  const isCloudConnected = Boolean(firebaseAdminEmail);

  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Dashboard customization config (loaded from Cloud Firestore or Express backend)
  const [adminConfig, setAdminConfig] = useState<AdminDashboardConfig>(DEFAULT_ADMIN_CONFIG);

  // Admissions state
  const [admissions, setAdmissions] = useState<StoredAdmissionRecord[]>([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(true);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
  }, []);

  const fetchUiConfig = useCallback(async () => {
    if (isCloudConnected) {
      try {
        const cloudCfg = await cloudGetAdminUiConfig();
        if (cloudCfg) {
          setAdminConfig(cloudCfg);
          return;
        }
      } catch {
        // Fallback smoothly to Express API if needed
      }
    }
    if (!adminToken || adminToken === 'firebase-cloud-session') return;
    try {
      const res = await fetch('/api/admin/ui-config', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { config?: Partial<AdminDashboardConfig> | null };
        if (data.config) {
          setAdminConfig(normalizeAdminConfig(data.config));
        }
      }
    } catch {
      // Fallback safely to DEFAULT_ADMIN_CONFIG
    }
  }, [adminToken, isCloudConnected, onLogout]);

  const fetchAdmissions = useCallback(async () => {
    if (isCloudConnected) {
      return;
    }
    if (!adminToken || adminToken === 'firebase-cloud-session') {
      setAdmissionsLoading(false);
      return;
    }
    setAdmissionsLoading(true);
    try {
      const res = await fetch('/api/admin/admissions', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = (await res.json()) as { admissions?: StoredAdmissionRecord[] };
      if (res.ok && Array.isArray(data.admissions)) {
        setAdmissions(data.admissions);
        const drafts: Record<string, string> = {};
        for (const adm of data.admissions) {
          drafts[adm.id] = adm.adminNote ?? '';
        }
        setNoteDrafts(drafts);
      }
    } catch {
      showToast(
        'error',
        isEn ? 'Failed to load admission submissions.' : 'ভর্তি আবেদনসমূহ লোড করা যায়নি।',
      );
    } finally {
      setAdmissionsLoading(false);
    }
  }, [adminToken, isCloudConnected, isEn, onLogout, showToast]);

  useEffect(() => {
    void fetchUiConfig();
  }, [fetchUiConfig]);

  useEffect(() => {
    if (!isCloudConnected) {
      void fetchAdmissions();
      return;
    }
    setAdmissionsLoading(true);
    const unsub = cloudSubscribeAdmissions(
      (list) => {
        setAdmissions(list);
        setNoteDrafts((prev) => {
          const next = { ...prev };
          for (const adm of list) {
            if (next[adm.id] === undefined) {
              next[adm.id] = adm.adminNote ?? '';
            }
          }
          return next;
        });
        setAdmissionsLoading(false);
      },
      () => {
        setAdmissionsLoading(false);
        showToast(
          'error',
          isEn
            ? 'Could not read cloud admissions. Ensure this Google account has admin access.'
            : 'ক্লাউড থেকে ভর্তি আবেদন লোড করা যায়নি। অনুগ্রহ করে অনুমোদিত অ্যাডমিন Google অ্যাকাউন্ট দিয়ে লগইন করুন।',
        );
      },
    );
    return () => unsub();
  }, [fetchAdmissions, isCloudConnected, isEn, showToast]);

  const executeCloudApi = useCallback(
    async <T,>(
      url: string,
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body?: unknown,
    ): Promise<T | null> => {
      if (url === '/api/admin/site-settings' && method === 'PUT') {
        const nextSettings = { ...cmsData.siteSettings, ...(body as Partial<SiteSettingsCms>) };
        await cloudSaveSiteSettings(nextSettings);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? { ...cmsData, siteSettings: nextSettings } } as unknown as T;
      }

      if (url === '/api/admin/hero' && method === 'PUT') {
        const nextHero = { ...cmsData.heroSection, ...(body as Partial<HeroSectionCms>) };
        await cloudSaveHeroSection(nextHero);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? { ...cmsData, heroSection: nextHero } } as unknown as T;
      }

      if (url === '/api/admin/about' && method === 'PUT') {
        const nextAbout = { ...cmsData.aboutSection, ...(body as Partial<AboutSectionCms>) };
        await cloudSaveAboutSection(nextAbout);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? { ...cmsData, aboutSection: nextAbout } } as unknown as T;
      }

      if (url === '/api/admin/departments' && method === 'POST') {
        await cloudUpsertDepartment(body as Partial<CmsDepartment>, cmsData.departments.length);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/departments/') && method === 'PUT') {
        const id = url.slice('/api/admin/departments/'.length);
        const idx = cmsData.departments.findIndex((d) => d.id === id);
        const existing = idx >= 0 ? cmsData.departments[idx] : ({ id } as CmsDepartment);
        await cloudUpsertDepartment(
          { ...existing, ...(body as Partial<CmsDepartment>), id },
          idx >= 0 ? idx : cmsData.departments.length,
        );
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/departments/') && method === 'DELETE') {
        const id = url.slice('/api/admin/departments/'.length);
        await cloudDeleteDepartment(id);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }

      if (url === '/api/admin/notices' && method === 'POST') {
        await cloudUpsertNotice(
          body as Partial<CmsNotice>,
          cmsData.siteSettings.brandFullBn,
          cmsData.siteSettings.brandFullEn,
        );
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/notices/') && url.endsWith('/status') && method === 'PATCH') {
        const id = url.slice('/api/admin/notices/'.length, -'/status'.length);
        const target = cmsData.notices.find((n) => n.id === id);
        if (target) {
          const { status } = (body ?? {}) as { status: NoticeStatus };
          await cloudSetNoticeStatus(target, status);
        }
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/notices/') && method === 'PUT') {
        const id = url.slice('/api/admin/notices/'.length);
        const target = cmsData.notices.find((n) => n.id === id);
        await cloudUpsertNotice(
          { ...(target ?? {}), ...(body as Partial<CmsNotice>), id },
          cmsData.siteSettings.brandFullBn,
          cmsData.siteSettings.brandFullEn,
        );
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/notices/') && method === 'DELETE') {
        const id = url.slice('/api/admin/notices/'.length);
        await cloudDeleteNotice(id);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }

      if (url === '/api/admin/gallery' && method === 'POST') {
        await cloudUpsertGalleryItem(body as Partial<CmsGalleryItem>, Date.now());
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/gallery/') && method === 'PUT') {
        const id = url.slice('/api/admin/gallery/'.length);
        const target = cmsData.gallery.find((g) => g.id === id);
        await cloudUpsertGalleryItem({ ...(target ?? {}), ...(body as Partial<CmsGalleryItem>), id });
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/gallery/') && method === 'DELETE') {
        const id = url.slice('/api/admin/gallery/'.length);
        await cloudDeleteGalleryItem(id);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }

      if (url === '/api/admin/teachers' && method === 'POST') {
        await cloudUpsertTeacher(body as Partial<CmsTeacherProfile>, cmsData.teachers.length);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/teachers/') && method === 'PUT') {
        const id = url.slice('/api/admin/teachers/'.length);
        const idx = cmsData.teachers.findIndex((t) => t.id === id);
        const target = idx >= 0 ? cmsData.teachers[idx] : ({ id } as CmsTeacherProfile);
        await cloudUpsertTeacher(
          { ...target, ...(body as Partial<CmsTeacherProfile>), id },
          idx >= 0 ? idx : cmsData.teachers.length,
        );
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }
      if (url.startsWith('/api/admin/teachers/') && method === 'DELETE') {
        const id = url.slice('/api/admin/teachers/'.length);
        await cloudDeleteTeacher(id);
        const snap = await fetchCloudCmsSnapshot();
        return { cms: snap ?? cmsData } as unknown as T;
      }

      if (url.startsWith('/api/admin/admissions/') && method === 'PATCH') {
        const id = url.slice('/api/admin/admissions/'.length);
        const { status, adminNote } = (body ?? {}) as {
          status?: AdmissionStatus;
          adminNote?: string;
        };
        const current = admissions.find((a) => a.id === id);
        await cloudUpdateAdmissionStatus(
          id,
          status ?? current?.status ?? 'pending',
          adminNote ?? current?.adminNote ?? '',
        );
        return { admissions } as unknown as T;
      }
      if (url.startsWith('/api/admin/admissions/') && method === 'DELETE') {
        const id = url.slice('/api/admin/admissions/'.length);
        await cloudDeleteAdmission(id);
        return { admissions: admissions.filter((a) => a.id !== id) } as unknown as T;
      }

      if (url === '/api/admin/reset-defaults' && method === 'POST') {
        const fresh = await cloudResetCmsDefaults();
        return { cms: fresh } as unknown as T;
      }

      return null;
    },
    [admissions, cmsData],
  );

  const apiRequest: AdminApiRequestFn = useCallback(
    async <T,>(
      url: string,
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body?: unknown,
    ): Promise<T | null> => {
      setSaving(true);
      setBanner(null);
      try {
        // 1. If connected to Cloud Firestore, persist directly to Firestore so Vercel & AI Studio sync immediately
        if (isCloudConnected && url !== '/api/admin/change-password') {
          try {
            const cloudResult = await executeCloudApi<T>(url, method, body);
            // Also mirror to local Express server when running locally with a server token
            if (adminToken && adminToken !== 'firebase-cloud-session') {
              void fetch(url, {
                method,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${adminToken}`,
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
              }).catch(() => {});
            }
            if (cloudResult) return cloudResult;
          } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
              showToast(
                'error',
                isEn
                  ? 'Permission denied by Firestore security rules. Sign in with the authorized admin Google account.'
                  : 'অনুমতি নেই: শুধুমাত্র অনুমোদিত অ্যাডমিন Google অ্যাকাউন্ট দিয়ে পরিবর্তন করা যাবে।',
              );
            } else {
              showToast(
                'error',
                isEn ? 'Failed to save changes to cloud database.' : 'ক্লাউড ডেটাবেসে পরিবর্তন সংরক্ষণ করা যায়নি।',
              );
            }
            return null;
          }
        }

        if (adminToken === 'firebase-cloud-session') {
          showToast(
            'error',
            isEn
              ? 'This action requires a local server login session.'
              : 'এই কাজটির জন্য লোকাল অ্যাডমিন পাসওয়ার্ড লগইন প্রয়োজন।',
          );
          return null;
        }

        // 2. Express backend fallback
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (res.status === 401) {
          onLogout();
          return null;
        }
        const data = (await res.json()) as T & { error?: string };
        if (!res.ok) {
          showToast('error', data.error ?? (isEn ? 'Action failed.' : 'কাজটি সম্পন্ন করা যায়নি।'));
          return null;
        }
        return data;
      } catch {
        showToast(
          'error',
          isEn ? 'Network error occurred.' : 'সার্ভারের সাথে সংযোগ সমস্যা হয়েছে।',
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [adminToken, executeCloudApi, isCloudConnected, isEn, onLogout, showToast],
  );

  const handleSaveUiConfig = async (nextConfig: AdminDashboardConfig) => {
    const normalized = normalizeAdminConfig(nextConfig);
    setSaving(true);
    setBanner(null);
    try {
      if (isCloudConnected) {
        const saved = await cloudSaveAdminUiConfig(normalized);
        setAdminConfig(saved);
        showToast(
          'success',
          isEn
            ? 'Dashboard theme & layout saved to Cloud.'
            : 'ড্যাশবোর্ডের থিম ও লেআউট ক্লাউডে সংরক্ষিত হয়েছে।',
        );
        return;
      }
      const res = await apiRequest<{ config: AdminDashboardConfig }>(
        '/api/admin/ui-config',
        'PUT',
        normalized,
      );
      if (res?.config) {
        setAdminConfig(normalizeAdminConfig(res.config));
        showToast(
          'success',
          isEn
            ? 'Dashboard theme & layout saved.'
            : 'ড্যাশবোর্ডের থিম ও লেআউট সফলভাবে সংরক্ষিত হয়েছে।',
        );
      }
    } catch {
      showToast(
        'error',
        isEn ? 'Could not save dashboard config.' : 'ড্যাশবোর্ড সেটিংস সেভ করা যায়নি।',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetUiConfig = async () => {
    setSaving(true);
    setBanner(null);
    try {
      if (isCloudConnected) {
        await cloudResetAdminUiConfig();
        setAdminConfig(DEFAULT_ADMIN_CONFIG);
        showToast(
          'success',
          isEn
            ? 'Dashboard style restored to default.'
            : 'ড্যাশবোর্ড স্টাইল ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে।',
        );
        return;
      }
      const res = await apiRequest<{ config: null }>('/api/admin/ui-config/reset', 'POST');
      if (res) {
        setAdminConfig(DEFAULT_ADMIN_CONFIG);
        showToast(
          'success',
          isEn
            ? 'Dashboard style restored to default.'
            : 'ড্যাশবোর্ড স্টাইল ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে।',
        );
      }
    } catch {
      showToast(
        'error',
        isEn ? 'Failed to reset dashboard style.' : 'ড্যাশবোর্ড স্টাইল রিসেট করা যায়নি।',
      );
    } finally {
      setSaving(false);
    }
  };

  const theme = useMemo(() => resolveAdminTheme(adminConfig), [adminConfig]);
  const cardRadiusClass = useMemo(
    () => getCardRadiusClass(adminConfig.cardRadius),
    [adminConfig.cardRadius],
  );

  const visibleNavItems = useMemo(() => {
    const counts: Partial<Record<AdminTabId, number>> = {
      admissions: admissions.length,
      notices: cmsData.notices.length,
      departments: cmsData.departments.length,
      gallery: cmsData.gallery.length,
      teachers: cmsData.teachers.length,
    };
    return adminConfig.tabOrder
      .filter((tabId) => !adminConfig.hiddenTabs.includes(tabId))
      .map((tabId) => {
        const label = adminConfig.customTabLabels[tabId] ?? DEFAULT_ADMIN_TAB_LABELS[tabId];
        return {
          id: tabId,
          bn: label.bn,
          en: label.en,
          icon: TAB_ICONS[tabId],
          count: counts[tabId],
        };
      });
  }, [
    adminConfig.customTabLabels,
    adminConfig.hiddenTabs,
    adminConfig.tabOrder,
    admissions.length,
    cmsData.departments.length,
    cmsData.gallery.length,
    cmsData.notices.length,
    cmsData.teachers.length,
  ]);

  useEffect(() => {
    if (adminConfig.hiddenTabs.includes(activeTab)) {
      setActiveTab(visibleNavItems[0]?.id ?? 'customize');
    }
  }, [activeTab, adminConfig.hiddenTabs, visibleNavItems]);

  const activeNavMeta = visibleNavItems.find((n) => n.id === activeTab) ?? visibleNavItems[0];

  const basePanelProps: AdminPanelBaseProps = {
    cmsData,
    adminToken,
    lang,
    saving,
    cardRadiusClass,
    primaryHex: theme.primary,
    apiRequest,
    onCmsUpdated,
    showToast,
  };

  return (
    <div className="min-h-screen text-[#0F172A]" style={{ backgroundColor: theme.canvasBg }}>
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={isEn ? 'Toggle sidebar' : 'মেনু টগল করুন'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] lg:hidden"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: theme.primary }}
            >
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <p className="truncate font-serif text-sm font-bold text-[#0F172A] sm:text-base">
                {isEn
                  ? `${cmsData.siteSettings.brandShortEn} · ${adminConfig.dashboardTitleEn}`
                  : `${cmsData.siteSettings.brandShortBn} · ${adminConfig.dashboardTitleBn}`}
              </p>
              <p className="hidden truncate text-xs text-[#475569] sm:block">
                {isEn ? 'Logged in as:' : 'লগইনকৃত অ্যাডমিন:'}{' '}
                <span className="font-semibold" style={{ color: theme.primary }}>
                  {adminUsername}
                </span>{' '}
                · {activeNavMeta ? (isEn ? activeNavMeta.en : activeNavMeta.bn) : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle lang={lang} onChange={onChangeLang} />

            {openSiteInNewTab ? (
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition-colors hover:border-[#065F46] hover:text-[#065F46] whitespace-nowrap shrink-0 sm:px-3.5 sm:py-2"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {isEn ? 'Main Website (New Tab)' : 'মূল ওয়েবসাইট (নতুন ট্যাব)'}
                </span>
              </a>
            ) : (
              onCloseDashboard && (
                <button
                  type="button"
                  onClick={onCloseDashboard}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition-colors hover:border-[#065F46] hover:text-[#065F46] whitespace-nowrap shrink-0 sm:px-3.5 sm:py-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {isEn ? 'View Website' : 'ওয়েবসাইট দেখুন'}
                  </span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap shrink-0 sm:px-3.5 sm:py-2"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{isEn ? 'Logout' : 'লগআউট'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          style={{ backgroundColor: theme.sidebarBg }}
          className={`fixed top-16 bottom-0 left-0 z-20 ${
            adminConfig.sidebarCompact ? 'w-56' : 'w-64'
          } border-r border-[#E2E8F0] p-3.5 transition-transform duration-200 lg:sticky lg:block lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:overflow-y-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">
            {isEn ? 'CMS Control Menu' : 'নিয়ন্ত্রণ মেনু'}
          </p>
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                    setBanner(null);
                  }}
                  style={
                    isActive
                      ? { backgroundColor: theme.primary, color: '#FFFFFF' }
                      : undefined
                  }
                  className={`flex w-full items-center justify-between rounded-lg px-3 ${
                    adminConfig.sidebarCompact ? 'py-2' : 'py-2.5'
                  } text-left text-xs font-medium transition-colors sm:text-sm ${
                    isActive
                      ? 'shadow-xs'
                      : 'text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{isEn ? item.en : item.bn}</span>
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#475569]'
                      }`}
                    >
                      {formatDigits(item.count, lang)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Workspace */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {/* Cloud Sync Banner (so admin immediately sees whether edits sync live to Vercel) */}
          {!isCloudConnected && onConnectCloudSync && (
            <div
              className={`mb-5 flex flex-col justify-between gap-3 ${cardRadiusClass} border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center`}
            >
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span>
                  {isEn
                    ? 'You are signed in locally. Connect Google Cloud Sync so your changes update live on Vercel as well.'
                    : 'আপনি লোকাল সেশনে আছেন। Vercel ও সকল ডিভাইসে লাইভ আপডেট পেতে Google ক্লাউড সিঙ্ক চালু করুন।'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onConnectCloudSync()}
                className="shrink-0 rounded-lg bg-[#065F46] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#047857]"
              >
                {isEn ? 'Connect Google Cloud Sync' : 'Google ক্লাউড সিঙ্ক চালু করুন'}
              </button>
            </div>
          )}

          {banner && (
            <div
              role="status"
              className={`mb-5 flex items-center justify-between gap-3 ${cardRadiusClass} border px-4 py-3 text-xs font-medium sm:text-sm ${
                banner.type === 'success'
                  ? 'border-emerald-200 bg-[#ECFDF5] text-[#065F46]'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{banner.text}</span>
              </span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="rounded p-1 hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewPanel
              cmsData={cmsData}
              admissions={admissions}
              config={adminConfig}
              lang={lang}
              cardRadiusClass={cardRadiusClass}
              primaryHex={theme.primary}
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'admissions' && (
            <AdmissionsPanel
              admissions={admissions}
              admissionsLoading={admissionsLoading}
              noteDrafts={noteDrafts}
              lang={lang}
              saving={saving}
              cardRadiusClass={cardRadiusClass}
              primaryHex={theme.primary}
              onChangeNoteDraft={(id, val) =>
                setNoteDrafts((prev) => ({ ...prev, [id]: val }))
              }
              onRefresh={fetchAdmissions}
              onAdmissionsUpdated={setAdmissions}
              onViewAdmissionReceipt={onViewAdmissionReceipt}
              apiRequest={apiRequest}
              showToast={showToast}
            />
          )}

          {activeTab === 'branding' && <BrandingPanel {...basePanelProps} />}
          {activeTab === 'hero' && <HeroPanel {...basePanelProps} />}
          {activeTab === 'about' && <AboutPanel {...basePanelProps} />}
          {activeTab === 'notices' && <NoticesPanel {...basePanelProps} />}
          {activeTab === 'departments' && <DepartmentsPanel {...basePanelProps} />}
          {activeTab === 'gallery' && <GalleryPanel {...basePanelProps} />}
          {activeTab === 'teachers' && <TeachersPanel {...basePanelProps} />}

          {activeTab === 'customize' && (
            <CustomizePanel
              config={adminConfig}
              lang={lang}
              saving={saving}
              cardRadiusClass={cardRadiusClass}
              onSaveConfig={handleSaveUiConfig}
              onResetConfig={handleResetUiConfig}
            />
          )}

          {activeTab === 'security' && <SecurityPanel {...basePanelProps} />}
        </main>
      </div>
    </div>
  );
}
