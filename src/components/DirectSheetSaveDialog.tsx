import { useState } from 'react';
import { CheckCircle2, ExternalLink, FileSpreadsheet, Loader2, X } from 'lucide-react';
import type { AdmissionSubmission } from '../data/madrasaData';
import type { StudentUser } from '../data/studentPortalData';
import type { Language } from '../data/madrasaTranslations';
import { getSheetsAccessToken, googleSignInForSheets } from '../lib/firebase';
import {
  appendRowToGoogleSheet,
  buildAdmissionSheetRow,
  buildStudentSheetRow,
  extractSpreadsheetId,
  getAdmissionSheetHeader,
  getSavedSheetsConfig,
  getStudentSheetHeader,
  saveSheetsConfig,
} from '../lib/googleSheetsSync';

export type PendingDirectSheetEntry =
  | {
      kind: 'admission';
      submission: AdmissionSubmission;
    }
  | {
      kind: 'student';
      student: StudentUser;
      accountType: 'register' | 'google_signin';
    };

interface DirectSheetSaveDialogProps {
  entry: PendingDirectSheetEntry | null;
  lang: Language;
  onClose: () => void;
  onSaved?: (info: { tabName: string; sheetUrl: string }) => void;
}

export function DirectSheetSaveDialog({
  entry,
  lang,
  onClose,
  onSaved,
}: DirectSheetSaveDialogProps) {
  const isEn = lang === 'en';
  const savedConfig = getSavedSheetsConfig();

  const [sheetUrlInput, setSheetUrlInput] = useState(savedConfig?.spreadsheetId ?? '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedResult, setSavedResult] = useState<{
    tabName: string;
    spreadsheetTitle: string;
    sheetUrl: string;
  } | null>(null);

  if (!entry) return null;

  const isStudent = entry.kind === 'student';
  const targetTabLabel = isStudent
    ? savedConfig?.studentTab || 'Sheet2'
    : savedConfig?.admissionTab || (isEn ? 'First Sheet Tab' : '১ম শিট ট্যাব');

  const handleConfirmAndSave = async () => {
    setErrorMsg('');
    const effectiveId = extractSpreadsheetId(sheetUrlInput || savedConfig?.spreadsheetId || '');
    if (!effectiveId) {
      setErrorMsg(
        isEn
          ? 'Please paste your Google Sheet link or Spreadsheet ID first.'
          : 'অনুগ্রহ করে আপনার Google Sheet-এর লিংক বা ID দিন।',
      );
      return;
    }

    setSaving(true);
    try {
      let token = getSheetsAccessToken();
      if (!token) {
        const authRes = await googleSignInForSheets();
        token = authRes.accessToken;
      }

      const header = isStudent ? getStudentSheetHeader() : getAdmissionSheetHeader();
      const row = isStudent
        ? buildStudentSheetRow(entry.student, entry.accountType)
        : buildAdmissionSheetRow(entry.submission);

      const result = await appendRowToGoogleSheet({
        accessToken: token,
        spreadsheetId: effectiveId,
        targetTab: isStudent ? savedConfig?.studentTab || 'Sheet2' : savedConfig?.admissionTab,
        isStudentRegistration: isStudent,
        header,
        row,
      });

      saveSheetsConfig({
        spreadsheetId: effectiveId,
        spreadsheetTitle: result.spreadsheetTitle,
        admissionTab: isStudent ? savedConfig?.admissionTab || '' : result.resolvedTab,
        studentTab: isStudent ? result.resolvedTab : savedConfig?.studentTab || 'Sheet2',
      });

      setSavedResult({
        tabName: result.resolvedTab,
        spreadsheetTitle: result.spreadsheetTitle,
        sheetUrl: result.sheetUrl,
      });
      onSaved?.({ tabName: result.resolvedTab, sheetUrl: result.sheetUrl });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('');
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : isEn
              ? 'Could not save directly to Google Sheets.'
              : 'সরাসরি Google Sheet-এ সেভ করা যায়নি।',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="direct-sheet-save-title"
    >
      <div
        className="relative mx-auto my-auto w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3.5">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-[#065F46]" aria-hidden="true" />
            <h3
              id="direct-sheet-save-title"
              className="font-serif text-base font-bold text-[#0F172A]"
            >
              {isEn ? 'Save Directly to Google Sheet' : 'সরাসরি Google Sheet-এ সেভ করুন'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            aria-label={isEn ? 'Close' : 'বন্ধ করুন'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          {savedResult ? (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                <div className="space-y-1.5">
                  <p className="font-bold">
                    {isEn
                      ? `Saved to "${savedResult.tabName}" in "${savedResult.spreadsheetTitle}"!`
                      : `"${savedResult.spreadsheetTitle}" ফাইলের "${savedResult.tabName}" ট্যাবে সরাসরি সেভ হয়েছে!`}
                  </p>
                  <a
                    href={savedResult.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#065F46] underline underline-offset-4 hover:text-[#047857]"
                  >
                    <span>{isEn ? 'Open Google Sheet' : 'Google Sheet খুলুন'}</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-[#065F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857]"
                >
                  {isEn ? 'Done' : 'সম্পন্ন'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-[#334155]">
                {isStudent
                  ? isEn
                    ? `Confirm appending this new student registration row to "${targetTabLabel}" in your Google Sheet:`
                    : `নতুন ছাত্র রেজিস্ট্রেশনের এই তথ্যটি সরাসরি আপনার Google Sheet-এর "${targetTabLabel}" ট্যাবে যুক্ত করতে চান?`
                  : isEn
                    ? `Confirm appending this online admission application to "${targetTabLabel}" in your Google Sheet:`
                    : `অনলাইন ভর্তি আবেদনের এই তথ্যটি সরাসরি আপনার Google Sheet-এর "${targetTabLabel}" ট্যাবে যুক্ত করতে চান?`}
              </p>

              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#0F172A]">
                {isStudent ? (
                  <dl className="space-y-1">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Roll:' : 'রোল:'}</dt>
                      <dd className="font-mono font-semibold">{entry.student.studentRoll}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Name:' : 'নাম:'}</dt>
                      <dd className="font-semibold">{entry.student.name}</dd>
                    </div>
                    {entry.student.phone && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#475569]">{isEn ? 'Mobile:' : 'মোবাইল:'}</dt>
                        <dd className="tabular-nums">{entry.student.phone}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Target Tab:' : 'টার্গেট শিট:'}</dt>
                      <dd className="font-semibold text-[#065F46]">{targetTabLabel}</dd>
                    </div>
                  </dl>
                ) : (
                  <dl className="space-y-1">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Tracking ID:' : 'ট্র্যাকিং ID:'}</dt>
                      <dd className="font-mono font-semibold">{entry.submission.trackingId}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Applicant:' : 'শিক্ষার্থীর নাম:'}</dt>
                      <dd className="font-semibold">{entry.submission.studentName}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Mobile:' : 'মোবাইল:'}</dt>
                      <dd className="tabular-nums">{entry.submission.mobile}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#475569]">{isEn ? 'Target Tab:' : 'টার্গেট শিট:'}</dt>
                      <dd className="font-semibold text-[#065F46]">{targetTabLabel}</dd>
                    </div>
                  </dl>
                )}
              </div>

              {!savedConfig?.spreadsheetId && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    {isEn ? 'Google Sheet URL or ID' : 'আপনার Google Sheet লিংক বা ID'}
                  </label>
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-slate-50"
                >
                  {isEn ? 'Skip' : 'বন্ধ করুন'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmAndSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#065F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  <span>
                    {saving
                      ? isEn
                        ? 'Saving...'
                        : 'সেভ হচ্ছে...'
                      : getSheetsAccessToken()
                        ? isEn
                          ? 'Confirm & Save to Sheet'
                          : 'হ্যাঁ, Google Sheet-এ সেভ করুন'
                        : isEn
                          ? 'Sign in with Google & Save'
                          : 'Google দিয়ে সংযুক্ত হয়ে সেভ করুন'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
