/**
 * ============================================================================
 * ADMIN DASHBOARD CUSTOMIZATION CONFIG (AI Studio Friendly)
 * ============================================================================
 * আপনি চাইলে সরাসরি এই ফাইলটি এডিট করে অথবা ড্যাশবোর্ডের
 * "ড্যাশবোর্ড কাস্টমাইজ" (Customize UI) ট্যাব থেকে রঙ, টাইটেল,
 * সাইডবার ট্যাব অর্ডার, এবং লেআউট নিজের মতো পরিবর্তন করতে পারবেন।
 */

export type AdminThemeId = 'emerald' | 'navy' | 'amber' | 'slate';

export type AdminTabId =
  | 'overview'
  | 'admissions'
  | 'branding'
  | 'hero'
  | 'about'
  | 'notices'
  | 'departments'
  | 'gallery'
  | 'teachers'
  | 'customize'
  | 'security';

export interface AdminThemeTokens {
  id: AdminThemeId;
  nameBn: string;
  nameEn: string;
  primary: string;
  primaryHover: string;
  accent: string;
  softBg: string;
  softBorder: string;
  sidebarBg: string;
  canvasBg: string;
}

export const ADMIN_THEME_PRESETS: Record<AdminThemeId, AdminThemeTokens> = {
  emerald: {
    id: 'emerald',
    nameBn: 'মাদ্রাসা সবুজ (ডিফল্ট)',
    nameEn: 'Madrasa Emerald',
    primary: '#065F46',
    primaryHover: '#047857',
    accent: '#B45309',
    softBg: '#ECFDF5',
    softBorder: '#A7F3D0',
    sidebarBg: '#FFFFFF',
    canvasBg: '#F8FAFC',
  },
  navy: {
    id: 'navy',
    nameBn: 'ইসলামিক নেভি ব্লু',
    nameEn: 'Royal Navy',
    primary: '#1E3A8A',
    primaryHover: '#1D4ED8',
    accent: '#B45309',
    softBg: '#EFF6FF',
    softBorder: '#BFDBFE',
    sidebarBg: '#FFFFFF',
    canvasBg: '#F8FAFC',
  },
  amber: {
    id: 'amber',
    nameBn: 'গোল্ডেন হেরিটেজ',
    nameEn: 'Warm Heritage',
    primary: '#92400E',
    primaryHover: '#B45309',
    accent: '#065F46',
    softBg: '#FFFBEB',
    softBorder: '#FDE68A',
    sidebarBg: '#FFFFFF',
    canvasBg: '#FAF9F6',
  },
  slate: {
    id: 'slate',
    nameBn: 'মিনিমাল ডার্ক স্লেট',
    nameEn: 'Minimal Slate',
    primary: '#0F172A',
    primaryHover: '#334155',
    accent: '#065F46',
    softBg: '#F1F5F9',
    softBorder: '#CBD5E1',
    sidebarBg: '#FFFFFF',
    canvasBg: '#F8FAFC',
  },
};

export interface AdminDashboardConfig {
  dashboardTitleBn: string;
  dashboardTitleEn: string;
  welcomeTitleBn: string;
  welcomeTitleEn: string;
  welcomeSubtitleBn: string;
  welcomeSubtitleEn: string;
  theme: AdminThemeId;
  customPrimaryHex: string;
  cardRadius: 'lg' | 'xl' | '2xl';
  sidebarCompact: boolean;
  showOverviewQuickActions: boolean;
  tabOrder: AdminTabId[];
  hiddenTabs: AdminTabId[];
  customTabLabels: Partial<Record<AdminTabId, { bn: string; en: string }>>;
}

export const ALL_ADMIN_TABS: AdminTabId[] = [
  'overview',
  'admissions',
  'branding',
  'hero',
  'about',
  'notices',
  'departments',
  'gallery',
  'teachers',
  'customize',
  'security',
];

export const DEFAULT_ADMIN_TAB_LABELS: Record<AdminTabId, { bn: string; en: string }> = {
  overview: { bn: 'ড্যাশবোর্ড সারসংক্ষেপ', en: 'Overview' },
  admissions: { bn: 'ভর্তি আবেদনসমূহ', en: 'Admissions' },
  branding: { bn: 'প্রতিষ্ঠান, লোগো ও তথ্য', en: 'Institution & Logo' },
  hero: { bn: 'হিরো ও ক্যাম্পাস ছবি', en: 'Hero & Photos' },
  about: { bn: 'মুহতামিমের বাণী ও পাঠাগার', en: "Principal's Message" },
  notices: { bn: 'নোটিশ ও সংরক্ষণাগার', en: 'Notices & Archive' },
  departments: { bn: 'শিক্ষা বিভাগসমূহ', en: 'Departments' },
  gallery: { bn: 'ফটো গ্যালারি', en: 'Photo Gallery' },
  teachers: { bn: 'শিক্ষকমণ্ডলী', en: 'Faculty / Teachers' },
  customize: { bn: 'ড্যাশবোর্ড কাস্টমাইজ', en: 'Customize Dashboard' },
  security: { bn: 'অ্যাডমিন নিরাপত্তা', en: 'Security & Reset' },
};

export const DEFAULT_ADMIN_CONFIG: AdminDashboardConfig = {
  dashboardTitleBn: 'অ্যাডমিন ড্যাশবোর্ড',
  dashboardTitleEn: 'Admin CMS',
  welcomeTitleBn: 'মাদ্রাসা ব্যাকএন্ড নিয়ন্ত্রণ প্যানেল',
  welcomeTitleEn: 'Madrasa Backend CMS Overview',
  welcomeSubtitleBn:
    'এখান থেকে ওয়েবসাইটের নাম, লোগো, যেকোনো ছবি, নোটিশ ও পূর্বের নোটিশ, শিক্ষা বিভাগ, শিক্ষকমণ্ডলী এবং অনলাইন ভর্তি আবেদন নিয়ন্ত্রণ করতে পারবেন।',
  welcomeSubtitleEn:
    'Manage institution branding, photos, Muhtamim message, notices, departments, faculty, and online admissions from one place.',
  theme: 'emerald',
  customPrimaryHex: '',
  cardRadius: 'xl',
  sidebarCompact: false,
  showOverviewQuickActions: true,
  tabOrder: [...ALL_ADMIN_TABS],
  hiddenTabs: [],
  customTabLabels: {},
};

export function normalizeAdminConfig(
  incoming?: Partial<AdminDashboardConfig> | null,
): AdminDashboardConfig {
  const merged: AdminDashboardConfig = {
    ...DEFAULT_ADMIN_CONFIG,
    ...(incoming ?? {}),
    tabOrder: Array.isArray(incoming?.tabOrder)
      ? [
          ...incoming.tabOrder.filter((t): t is AdminTabId => ALL_ADMIN_TABS.includes(t)),
          ...ALL_ADMIN_TABS.filter((t) => !incoming.tabOrder?.includes(t)),
        ]
      : [...ALL_ADMIN_TABS],
    hiddenTabs: Array.isArray(incoming?.hiddenTabs)
      ? incoming.hiddenTabs.filter(
          (t): t is AdminTabId =>
            ALL_ADMIN_TABS.includes(t) && t !== 'customize' && t !== 'security',
        )
      : [],
    customTabLabels:
      incoming?.customTabLabels && typeof incoming.customTabLabels === 'object'
        ? incoming.customTabLabels
        : {},
  };
  return merged;
}

export function resolveAdminTheme(config: AdminDashboardConfig): AdminThemeTokens {
  const base = ADMIN_THEME_PRESETS[config.theme] ?? ADMIN_THEME_PRESETS.emerald;
  const customHex = config.customPrimaryHex?.trim();
  if (customHex && /^#[0-9a-fA-F]{6}$/.test(customHex)) {
    return {
      ...base,
      primary: customHex,
      primaryHover: customHex,
    };
  }
  return base;
}

export function getCardRadiusClass(radius: AdminDashboardConfig['cardRadius']): string {
  if (radius === 'lg') return 'rounded-lg';
  if (radius === '2xl') return 'rounded-2xl';
  return 'rounded-xl';
}
