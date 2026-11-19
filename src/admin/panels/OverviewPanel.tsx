import type { SiteCmsData, StoredAdmissionRecord } from '../../data/cmsTypes';
import { formatDigits, type Language } from '../../data/madrasaTranslations';
import type { AdminDashboardConfig, AdminTabId } from '../adminConfig';

interface OverviewPanelProps {
  cmsData: SiteCmsData;
  admissions: StoredAdmissionRecord[];
  config: AdminDashboardConfig;
  lang: Language;
  cardRadiusClass: string;
  primaryHex: string;
  onSelectTab: (tab: AdminTabId) => void;
}

export function OverviewPanel({
  cmsData,
  admissions,
  config,
  lang,
  cardRadiusClass,
  primaryHex,
  onSelectTab,
}: OverviewPanelProps) {
  const isEn = lang === 'en';
  const activeNoticesCount = cmsData.notices.filter((n) => n.status !== 'archived').length;
  const archivedNoticesCount = cmsData.notices.filter((n) => n.status === 'archived').length;
  const pendingAdmissionsCount = admissions.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl font-bold text-[#0F172A] sm:text-2xl">
          {isEn ? config.welcomeTitleEn : config.welcomeTitleBn}
        </h1>
        <p className="mt-1 text-sm text-[#475569]">
          {isEn ? config.welcomeSubtitleEn : config.welcomeSubtitleBn}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5`}>
          <p className="text-xs font-medium text-[#475569]">
            {isEn ? 'Online Admissions' : 'অনলাইন ভর্তি আবেদন'}
          </p>
          <p
            className="mt-2 font-serif text-2xl font-bold tabular-nums"
            style={{ color: primaryHex }}
          >
            {formatDigits(admissions.length, lang)}
          </p>
          <p className="mt-1 text-xs text-[#B45309] tabular-nums">
            {isEn
              ? `${pendingAdmissionsCount} pending review`
              : `${formatDigits(pendingAdmissionsCount, lang)}টি আবেদন অপেক্ষমাণ`}
          </p>
        </div>

        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5`}>
          <p className="text-xs font-medium text-[#475569]">
            {isEn ? 'Notice Board & Archive' : 'নোটিশ ও সংরক্ষণাগার'}
          </p>
          <p
            className="mt-2 font-serif text-2xl font-bold tabular-nums"
            style={{ color: primaryHex }}
          >
            {formatDigits(activeNoticesCount, lang)}
          </p>
          <p className="mt-1 text-xs text-[#475569] tabular-nums">
            {isEn
              ? `${archivedNoticesCount} saved in previous archive`
              : `${formatDigits(archivedNoticesCount, lang)}টি পূর্বের নোটিশ সংরক্ষিত`}
          </p>
        </div>

        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5`}>
          <p className="text-xs font-medium text-[#475569]">
            {isEn ? 'Academic Departments' : 'মোট শিক্ষা বিভাগ'}
          </p>
          <p
            className="mt-2 font-serif text-2xl font-bold tabular-nums"
            style={{ color: primaryHex }}
          >
            {formatDigits(cmsData.departments.length, lang)}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            {isEn ? 'Synced with admission forms' : 'ভর্তি ফরমের সাথে সংযুক্ত'}
          </p>
        </div>

        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5`}>
          <p className="text-xs font-medium text-[#475569]">
            {isEn ? 'Teachers & Gallery Photos' : 'শিক্ষক ও গ্যালারি ছবি'}
          </p>
          <p
            className="mt-2 font-serif text-2xl font-bold tabular-nums"
            style={{ color: primaryHex }}
          >
            {formatDigits(cmsData.teachers.length, lang)} /{' '}
            {formatDigits(cmsData.gallery.length, lang)}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            {isEn ? 'Faculty profiles · Gallery items' : 'শিক্ষক · গ্যালারি ফটো'}
          </p>
        </div>
      </div>

      {config.showOverviewQuickActions && (
        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
          <h2 className="font-serif text-base font-bold text-[#0F172A]">
            {isEn ? 'Quick Management Actions' : 'দ্রুত সম্পাদনা মেনু'}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                tab: 'admissions' as AdminTabId,
                title: isEn ? 'View Admission Applications' : 'ভর্তি আবেদন দেখুন',
                sub: isEn ? 'Review, approve or export CSV' : 'সংরক্ষিত আবেদন ও স্ট্যাটাস',
              },
              {
                tab: 'records' as AdminTabId,
                title: isEn ? 'View Database & CSV File' : 'সকল ডাটাবেজ রেকর্ড দেখুন',
                sub: isEn ? 'Forms, logins, emails & CSV export' : 'নাম, পিতা, মোবাইল, ইমেইল ও CSV ফাইল',
              },
              {
                tab: 'notices' as AdminTabId,
                title: isEn ? 'Publish or Archive Notice' : 'নোটিশ যোগ বা সংরক্ষণ',
                sub: isEn ? 'Keep old notices saved' : 'নতুন নোটিশ ও পূর্বের রেকর্ড',
              },
              {
                tab: 'branding' as AdminTabId,
                title: isEn ? 'Edit Name, Logo & Info' : 'নাম, লোগো ও তথ্য বদলান',
                sub: isEn ? 'Header, footer & contacts' : 'প্রতিষ্ঠানের মূল পরিচয়',
              },
            ].map((card) => (
              <button
                key={card.tab}
                type="button"
                onClick={() => onSelectTab(card.tab)}
                className={`${cardRadiusClass} border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left transition-colors hover:border-[#065F46] hover:bg-[#ECFDF5]/60`}
              >
                <p className="text-sm font-semibold text-[#0F172A]">{card.title}</p>
                <p className="mt-1 text-xs text-[#475569]">{card.sub}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
