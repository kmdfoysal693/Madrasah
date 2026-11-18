import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Palette,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ADMIN_THEME_PRESETS,
  DEFAULT_ADMIN_TAB_LABELS,
  resolveAdminTheme,
  type AdminDashboardConfig,
  type AdminTabId,
  type AdminThemeId,
} from '../adminConfig';
import type { CustomizePanelProps } from '../types';

export function CustomizePanel({
  config,
  lang,
  saving,
  cardRadiusClass,
  onSaveConfig,
  onResetConfig,
}: CustomizePanelProps) {
  const isEn = lang === 'en';
  const [draft, setDraft] = useState<AdminDashboardConfig>(config);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const previewTheme = resolveAdminTheme(draft);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSaveConfig(draft);
  };

  const moveTab = (tabId: AdminTabId, direction: -1 | 1) => {
    setDraft((prev) => {
      const idx = prev.tabOrder.indexOf(tabId);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.tabOrder.length) return prev;
      const nextOrder = [...prev.tabOrder];
      const [item] = nextOrder.splice(idx, 1);
      nextOrder.splice(nextIdx, 0, item);
      return { ...prev, tabOrder: nextOrder };
    });
  };

  const toggleTabVisibility = (tabId: AdminTabId) => {
    if (tabId === 'customize' || tabId === 'security') return;
    setDraft((prev) => {
      const hidden = prev.hiddenTabs.includes(tabId);
      return {
        ...prev,
        hiddenTabs: hidden
          ? prev.hiddenTabs.filter((id) => id !== tabId)
          : [...prev.hiddenTabs, tabId],
      };
    });
  };

  const updateTabLabel = (tabId: AdminTabId, field: 'bn' | 'en', value: string) => {
    setDraft((prev) => {
      const current = prev.customTabLabels[tabId] ?? DEFAULT_ADMIN_TAB_LABELS[tabId];
      return {
        ...prev,
        customTabLabels: {
          ...prev.customTabLabels,
          [tabId]: {
            ...current,
            [field]: value,
          },
        },
      };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn
              ? 'Customize Admin Dashboard'
              : 'অ্যাডমিন ড্যাশবোর্ড কাস্টমাইজ করুন'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Change dashboard theme colors, titles, card shape, sidebar menu order, and labels visually or ask AI Studio anytime to customize any section.'
              : 'এখান থেকে ড্যাশবোর্ডের রঙ, শিরোনাম, কার্ড স্টাইল এবং সাইডবার মেনু নিজের মতো সাজাতে পারবেন — অথবা AI Studio-তে যেকোনো অংশ পরিবর্তনের নির্দেশ দিতে পারবেন।'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: previewTheme.primary }}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Save Dashboard Style' : 'ড্যাশবোর্ড স্টাইল সেভ করুন'}</span>
        </button>
      </div>

      {/* Theme Colors & Card Layout */}
      <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
          <Palette className="h-4 w-4" style={{ color: previewTheme.primary }} />
          <h2 className="font-serif text-base font-bold text-[#0F172A]">
            {isEn ? 'Theme Colors & Layout Style' : 'থিম কালার ও লেআউট স্টাইল'}
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(ADMIN_THEME_PRESETS) as AdminThemeId[]).map((presetKey) => {
            const preset = ADMIN_THEME_PRESETS[presetKey];
            const selected = draft.theme === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, theme: presetKey }))}
                className={`flex items-center gap-3 ${cardRadiusClass} border p-3.5 text-left transition-all ${
                  selected
                    ? 'border-[#0F172A] bg-slate-50 ring-2 ring-[#0F172A]/10'
                    : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                }`}
              >
                <span
                  className="h-7 w-7 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.primary }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#0F172A]">
                    {isEn ? preset.nameEn : preset.nameBn}
                  </p>
                  <p className="text-[11px] text-[#64748B]">{preset.primary}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Custom Accent Color (Optional)' : 'কাস্টম প্রাইমারি কালার (ঐচ্ছিক)'}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(draft.customPrimaryHex)
                    ? draft.customPrimaryHex
                    : ADMIN_THEME_PRESETS[draft.theme].primary
                }
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customPrimaryHex: e.target.value }))
                }
                className="h-9 w-11 cursor-pointer rounded border border-[#CBD5E1] bg-white p-0.5"
              />
              <input
                type="text"
                value={draft.customPrimaryHex}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customPrimaryHex: e.target.value }))
                }
                placeholder="#065F46"
                className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
              {draft.customPrimaryHex && (
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, customPrimaryHex: '' }))}
                  className="rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-xs text-[#475569] hover:bg-slate-50"
                >
                  {isEn ? 'Clear' : 'মুছুন'}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Card Corner Style' : 'কার্ডের কোণার ডিজাইন'}
            </label>
            <select
              value={draft.cardRadius}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  cardRadius: e.target.value as AdminDashboardConfig['cardRadius'],
                }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
            >
              <option value="lg">{isEn ? 'Sharp / Classic' : 'হালকা রাউন্ডেড (ক্লাসিক)'}</option>
              <option value="xl">{isEn ? 'Balanced Modern (Default)' : 'আধুনিক রাউন্ডেড (ডিফল্ট)'}</option>
              <option value="2xl">{isEn ? 'Soft Pillowed' : 'সফট কার্ড (বড় রাউন্ড)'}</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2.5 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0F172A]">
              <input
                type="checkbox"
                checked={draft.sidebarCompact}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, sidebarCompact: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[#CBD5E1]"
              />
              <span>{isEn ? 'Compact sidebar layout' : 'কম্প্যাক্ট সাইডবার লেআউট'}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0F172A]">
              <input
                type="checkbox"
                checked={draft.showOverviewQuickActions}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    showOverviewQuickActions: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-[#CBD5E1]"
              />
              <span>{isEn ? 'Show quick actions on Overview' : 'সারসংক্ষেপে দ্রুত বাটন দেখান'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Dashboard Titles & Welcome Banner */}
      <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
          <SlidersHorizontal className="h-4 w-4" style={{ color: previewTheme.primary }} />
          <h2 className="font-serif text-base font-bold text-[#0F172A]">
            {isEn ? 'Dashboard Header & Welcome Text' : 'ড্যাশবোর্ডের শিরোনাম ও স্বাগত বার্তা'}
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Header Title (Bengali)' : 'উপরের টাইটেল (বাংলা)'}
            </label>
            <input
              type="text"
              value={draft.dashboardTitleBn}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, dashboardTitleBn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Header Title (English)' : 'উপরের টাইটেল (ইংরেজি)'}
            </label>
            <input
              type="text"
              value={draft.dashboardTitleEn}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, dashboardTitleEn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Overview Heading (Bengali)' : 'ওভারভিউ শিরোনাম (বাংলা)'}
            </label>
            <input
              type="text"
              value={draft.welcomeTitleBn}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, welcomeTitleBn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Overview Heading (English)' : 'ওভারভিউ শিরোনাম (ইংরেজি)'}
            </label>
            <input
              type="text"
              value={draft.welcomeTitleEn}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, welcomeTitleEn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Overview Subtitle (Bengali)' : 'ওভারভিউ বিবরণ (বাংলা)'}
            </label>
            <textarea
              rows={2}
              value={draft.welcomeSubtitleBn}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, welcomeSubtitleBn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Overview Subtitle (English)' : 'ওভারভিউ বিবরণ (ইংরেজি)'}
            </label>
            <textarea
              rows={2}
              value={draft.welcomeSubtitleEn}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, welcomeSubtitleEn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Sidebar Tabs Reordering, Visibility & Labels */}
      <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
        <h2 className="font-serif text-base font-bold text-[#0F172A]">
          {isEn
            ? 'Sidebar Menu Order, Visibility & Custom Names'
            : 'সাইডবার মেনুর ক্রম, দৃশ্যমানতা ও নাম পরিবর্তন'}
        </h2>
        <p className="mt-1 text-xs text-[#475569]">
          {isEn
            ? 'Arrange the order of sidebar tabs, rename them, or hide unused sections.'
            : 'সাইডবার মেনুগুলো উপরে-নিচে সাজান, নাম পরিবর্তন করুন অথবা অপ্রয়োজনীয় মেনু লুকিয়ে রাখুন।'}
        </p>

        <div className="mt-4 space-y-2.5">
          {draft.tabOrder.map((tabId, idx) => {
            const labels = draft.customTabLabels[tabId] ?? DEFAULT_ADMIN_TAB_LABELS[tabId];
            const isHidden = draft.hiddenTabs.includes(tabId);
            const isLocked = tabId === 'customize' || tabId === 'security';

            return (
              <div
                key={tabId}
                className={`flex flex-col gap-3 rounded-lg border border-[#E2E8F0] p-3 sm:flex-row sm:items-center ${
                  isHidden ? 'bg-slate-50 opacity-70' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveTab(tabId, -1)}
                    aria-label={isEn ? 'Move up' : 'উপরে নিন'}
                    className="rounded border border-[#E2E8F0] p-1.5 text-[#475569] hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === draft.tabOrder.length - 1}
                    onClick={() => moveTab(tabId, 1)}
                    aria-label={isEn ? 'Move down' : 'নিচে নিন'}
                    className="rounded border border-[#E2E8F0] p-1.5 text-[#475569] hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => toggleTabVisibility(tabId)}
                    title={
                      isLocked
                        ? isEn
                          ? 'Essential section cannot be hidden'
                          : 'জরুরি সেকশন লুকানো যাবে না'
                        : isHidden
                          ? isEn
                            ? 'Show tab'
                            : 'মেনু দেখান'
                          : isEn
                            ? 'Hide tab'
                            : 'মেনু লুকান'
                    }
                    className={`rounded border px-2 py-1.5 text-xs font-medium ${
                      isLocked
                        ? 'cursor-not-allowed border-slate-200 text-slate-300'
                        : isHidden
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-[#E2E8F0] text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={labels.bn}
                    onChange={(e) => updateTabLabel(tabId, 'bn', e.target.value)}
                    placeholder={DEFAULT_ADMIN_TAB_LABELS[tabId].bn}
                    className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-medium text-[#0F172A]"
                  />
                  <input
                    type="text"
                    value={labels.en}
                    onChange={(e) => updateTabLabel(tabId, 'en', e.target.value)}
                    placeholder={DEFAULT_ADMIN_TAB_LABELS[tabId].en}
                    className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-medium text-[#0F172A]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset UI Config */}
      <div className={`flex flex-col justify-between gap-3 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:flex-row sm:items-center`}>
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">
            {isEn ? 'Reset Dashboard Customization' : 'ড্যাশবোর্ড ডিজাইন ডিফল্ট অবস্থায় ফেরান'}
          </p>
          <p className="mt-0.5 text-xs text-[#475569]">
            {isEn
              ? 'Only resets dashboard colors, titles, and tab order. Website CMS data and admissions remain untouched.'
              : 'শুধুমাত্র ড্যাশবোর্ডের রঙ, টাইটেল ও মেনু সাজানো রিসেট হবে; ওয়েবসাইটের কোনো তথ্য বা আবেদন মুছবে না।'}
          </p>
        </div>

        {confirmReset ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await onResetConfig();
                setConfirmReset(false);
              }}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white"
            >
              {isEn ? 'Confirm Reset' : 'নিশ্চিত রিসেট'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs"
            >
              {isEn ? 'Cancel' : 'বাতিল'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#475569] hover:border-red-300 hover:text-red-700 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{isEn ? 'Restore Default Style' : 'ডিফল্ট স্টাইল ফিরিয়ে আনুন'}</span>
          </button>
        )}
      </div>
    </form>
  );
}
