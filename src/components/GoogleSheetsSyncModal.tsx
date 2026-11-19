import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import type { Language } from '../data/madrasaTranslations';
import {
  getSheetsAccessToken,
  googleSignInForSheets,
  initSheetsAuth,
  logoutSheetsAuth,
} from '../lib/firebase';

interface UnifiedExportRecord {
  id: number;
  recordType: string;
  referenceCode: string;
  name: string;
  fatherName: string;
  mobile: string;
  email: string;
  passwordHash: string;
  dateOfBirth: string;
  department: string;
  className: string;
  residentialType: string;
  address: string;
  status: string;
  firebaseUid: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
}

interface SheetMetadataResponse {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
}

type PendingConfirmation =
  | {
      mode: 'create';
      title: string;
      rowCount: number;
    }
  | {
      mode: 'update';
      spreadsheetId: string;
      spreadsheetTitle: string;
      tabName: string;
      rowCount: number;
    };

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

function formatRecordTypeLabel(type: string, lang: Language): string {
  if (lang === 'en') {
    if (type === 'online_admission') return 'Online Admission';
    if (type === 'google_signin') return 'Google Sign-In';
    if (type === 'student_account') return 'Student Registration';
    return type;
  }
  if (type === 'online_admission') return 'অনলাইন ভর্তি আবেদন';
  if (type === 'google_signin') return 'Google লগইন';
  if (type === 'student_account') return 'শিক্ষার্থী নিবন্ধন';
  return type;
}

export function GoogleSheetsSyncModal({ isOpen, lang, onClose }: GoogleSheetsSyncModalProps) {
  const isEn = lang === 'en';
  const [sheetsUser, setSheetsUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getSheetsAccessToken());
  const [idToken, setIdToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [records, setRecords] = useState<UnifiedExportRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [sheetInput, setSheetInput] = useState(() => {
    try {
      return localStorage.getItem('madrasa_sheet_id') ?? '';
    } catch {
      return '';
    }
  });
  const [spreadsheetTitle, setSpreadsheetTitle] = useState('');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedSheetUrl, setSyncedSheetUrl] = useState('');
  const [syncedMessage, setSyncedMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubscribe = initSheetsAuth(
      (user, token) => {
        setSheetsUser(user);
        setAccessToken(token);
      },
      () => {
        setSheetsUser(null);
        setAccessToken(null);
        setIdToken(null);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const fetchRecords = async (firebaseIdToken: string): Promise<UnifiedExportRecord[]> => {
    setLoadingRecords(true);
    try {
      const res = await fetch('/api/records/export', {
        headers: { Authorization: `Bearer ${firebaseIdToken}` },
      });
      const text = await res.text();
      const parsed = text ? (JSON.parse(text) as { records?: UnifiedExportRecord[]; error?: string }) : {};
      if (!res.ok) {
        throw new Error(parsed.error || 'ডাটা লোড করা যায়নি।');
      }
      const list = Array.isArray(parsed.records) ? parsed.records : [];
      setRecords(list);
      return list;
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !sheetsUser || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const freshIdToken = idToken || (await sheetsUser.getIdToken());
        if (!cancelled) {
          setIdToken(freshIdToken);
          await fetchRecords(freshIdToken);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'ডাটা লোড করতে সমস্যা হয়েছে।');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sheetsUser, accessToken, idToken]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSyncedMessage('');
    setSigningIn(true);
    try {
      const res = await googleSignInForSheets();
      setSheetsUser(res.user);
      setAccessToken(res.accessToken);
      setIdToken(res.idToken);
      await fetchRecords(res.idToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMsg(
          isEn
            ? 'Could not connect Google account. Please allow the popup and grant spreadsheet access.'
            : 'Google অ্যাকাউন্ট সংযুক্ত করা যায়নি। অনুগ্রহ করে পপআপ অনুমোদন করে আবার চেষ্টা করুন।',
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutSheetsAuth();
    setSheetsUser(null);
    setAccessToken(null);
    setIdToken(null);
    setRecords([]);
    setAvailableTabs([]);
    setSelectedTab('');
    setSpreadsheetTitle('');
    setPendingConfirm(null);
    setSyncedMessage('');
    setSyncedSheetUrl('');
  };

  const buildSheetRows = (rows: UnifiedExportRecord[]): string[][] => {
    const header = [
      'ID',
      'ধরন (Record Type)',
      'রেফারেন্স কোড (Reference Code)',
      'নাম (Name)',
      'পিতার নাম (Father Name)',
      'মোবাইল (Mobile)',
      'ইমেইল (Email)',
      'পাসওয়ার্ড হ্যাশ (Password Hash)',
      'জন্ম তারিখ (Date of Birth)',
      'বিভাগ (Department)',
      'জামাত / শ্রেণি (Class)',
      'আবাসিক ধরন (Residential Type)',
      'ঠিকানা (Address)',
      'অবস্থা (Status)',
      'সর্বশেষ লগইন (Last Login)',
      'জমার সময় (Created At)',
    ];

    const body = rows.map((r) => [
      String(r.id),
      formatRecordTypeLabel(r.recordType, lang),
      r.referenceCode,
      r.name,
      r.fatherName,
      r.mobile,
      r.email,
      r.passwordHash,
      r.dateOfBirth,
      r.department,
      r.className,
      r.residentialType,
      r.address,
      r.status,
      r.lastLoginAt ?? '',
      r.createdAt,
    ]);

    return [header, ...body];
  };

  const handleLoadSpreadsheetMetadata = async () => {
    if (!accessToken) return;
    const sid = extractSpreadsheetId(sheetInput);
    if (!sid) {
      setErrorMsg(
        isEn
          ? 'Please enter a valid Google Sheet URL or Spreadsheet ID.'
          : 'অনুগ্রহ করে একটি সঠিক Google Sheet লিংক বা ID দিন।',
      );
      return;
    }

    setErrorMsg('');
    setSyncedMessage('');
    setLoadingMeta(true);
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sid)}?fields=properties.title,sheets.properties.title`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const data = (await res.json()) as SheetMetadataResponse & {
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(
          data.error?.message ||
            (isEn
              ? 'Could not access this Google Sheet. Make sure you have edit access.'
              : 'এই Google Sheet-এ প্রবেশ করা যায়নি। আপনার অ্যাকাউন্টে এডিট করার অনুমতি আছে কিনা যাচাই করুন।'),
        );
      }
      const tabs = (data.sheets ?? [])
        .map((s) => s.properties?.title)
        .filter((t): t is string => Boolean(t));
      setSpreadsheetTitle(data.properties?.title || sid);
      setAvailableTabs(tabs);
      setSelectedTab(tabs[0] ?? '');
      try {
        localStorage.setItem('madrasa_sheet_id', sid);
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Failed to load spreadsheet details.'
            : 'স্প্রেডশিটের তথ্য লোড করা যায়নি।',
      );
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleRequestCreateSheet = async () => {
    if (!sheetsUser) return;
    setErrorMsg('');
    setSyncedMessage('');
    const latestIdToken = idToken || (await sheetsUser.getIdToken());
    const latest = await fetchRecords(latestIdToken);
    setPendingConfirm({
      mode: 'create',
      title: 'Darus Salam Madrasa — Student & Admission Records',
      rowCount: latest.length,
    });
  };

  const handleRequestUpdateSheet = async () => {
    if (!sheetsUser || !selectedTab) return;
    const sid = extractSpreadsheetId(sheetInput);
    if (!sid) return;
    setErrorMsg('');
    setSyncedMessage('');
    const latestIdToken = idToken || (await sheetsUser.getIdToken());
    const latest = await fetchRecords(latestIdToken);
    setPendingConfirm({
      mode: 'update',
      spreadsheetId: sid,
      spreadsheetTitle: spreadsheetTitle || sid,
      tabName: selectedTab,
      rowCount: latest.length,
    });
  };

  const executeConfirmedSync = async () => {
    if (!pendingConfirm || !accessToken) return;
    setSyncing(true);
    setErrorMsg('');
    try {
      const values = buildSheetRows(records);

      if (pendingConfirm.mode === 'create') {
        const tabName = 'MadrasaRecords';
        const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: { title: pendingConfirm.title },
            sheets: [
              {
                properties: {
                  title: tabName,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            ],
          }),
        });
        const created = (await createRes.json()) as {
          spreadsheetId?: string;
          spreadsheetUrl?: string;
          error?: { message?: string };
        };
        if (!createRes.ok || !created.spreadsheetId) {
          throw new Error(created.error?.message || 'নতুন Google Sheet তৈরি করা যায়নি।');
        }

        const writeRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values/${encodeURIComponent(tabName)}!A1?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values }),
          },
        );
        if (!writeRes.ok) {
          const writeErr = (await writeRes.json()) as { error?: { message?: string } };
          throw new Error(writeErr.error?.message || 'শিটে ডাটা লেখা যায়নি।');
        }

        setSheetInput(created.spreadsheetId);
        setSpreadsheetTitle(pendingConfirm.title);
        setAvailableTabs([tabName]);
        setSelectedTab(tabName);
        try {
          localStorage.setItem('madrasa_sheet_id', created.spreadsheetId);
        } catch {
          // ignore
        }
        const url =
          created.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`;
        setSyncedSheetUrl(url);
        setSyncedMessage(
          isEn
            ? `Created new Google Sheet and synced ${records.length} record(s).`
            : `নতুন Google Sheet তৈরি করে মোট ${records.length}টি তথ্য সফলভাবে যুক্ত করা হয়েছে!`,
        );
      } else {
        const range = `${pendingConfirm.tabName}!A1`;
        const clearRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(pendingConfirm.spreadsheetId)}/values/${encodeURIComponent(pendingConfirm.tabName)}:clear`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!clearRes.ok) {
          const clearErr = (await clearRes.json()) as { error?: { message?: string } };
          throw new Error(clearErr.error?.message || 'শিটের ট্যাব প্রস্তুত করা যায়নি।');
        }

        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(pendingConfirm.spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values }),
          },
        );
        if (!updateRes.ok) {
          const updateErr = (await updateRes.json()) as { error?: { message?: string } };
          throw new Error(updateErr.error?.message || 'Google Sheet আপডেট করা যায়নি।');
        }

        const url = `https://docs.google.com/spreadsheets/d/${pendingConfirm.spreadsheetId}/edit`;
        setSyncedSheetUrl(url);
        setSyncedMessage(
          isEn
            ? `Successfully updated "${pendingConfirm.tabName}" with ${records.length} record(s).`
            : `"${pendingConfirm.tabName}" ট্যাবে মোট ${records.length}টি তথ্য সফলভাবে যুক্ত করা হয়েছে!`,
        );
      }

      setPendingConfirm(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not sync data to Google Sheets.'
            : 'Google Sheet-এ ডাটা পাঠাতে সমস্যা হয়েছে।',
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-sheets-sync-title"
    >
      <div
        className="relative mx-auto my-auto w-full max-w-xl overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-[#065F46]" aria-hidden="true" />
            <h2
              id="google-sheets-sync-title"
              className="font-serif text-lg font-bold text-[#0F172A]"
            >
              {isEn ? 'Sync Madrasa Data to Google Sheets' : 'Google Sheet-এ সকল ডাটা যুক্ত করুন'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            aria-label={isEn ? 'Close' : 'বন্ধ করুন'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          {syncedMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                <div className="space-y-2">
                  <p className="font-semibold">{syncedMessage}</p>
                  {syncedSheetUrl && (
                    <a
                      href={syncedSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#065F46] underline underline-offset-4 hover:text-[#047857]"
                    >
                      <span>{isEn ? 'Open Google Sheet' : 'Google Sheet খুলুন'}</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {!accessToken || !sheetsUser ? (
            <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 text-center">
              <p className="text-sm text-[#334155]">
                {isEn
                  ? 'Sign in with your Google account to create a Google Sheet or append all online admissions and student records to an existing sheet.'
                  : 'অনলাইন ভর্তি আবেদন ও শিক্ষার্থী লগইন/নিবন্ধনের সকল তথ্য সরাসরি আপনার Google Sheet-এ যুক্ত করতে আপনার Google অ্যাকাউন্ট দিয়ে সাইন-ইন করুন।'}
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={handleGoogleSignIn}
                  className="inline-flex h-10 items-center justify-center gap-3 rounded-md border border-[#747775] bg-white px-4 text-sm font-medium text-[#1F1F1F] shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="h-5 w-5 shrink-0">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="block h-5 w-5"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </span>
                  <span>{signingIn ? (isEn ? 'Connecting...' : 'সংযুক্ত হচ্ছে...') : 'Sign in with Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Connected Google Account Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs">
                <div>
                  <p className="font-semibold text-[#0F172A]">
                    {sheetsUser.displayName || sheetsUser.email}
                  </p>
                  <p className="text-[#475569]">
                    {sheetsUser.email} ·{' '}
                    <span className="font-semibold text-[#065F46]">
                      {loadingRecords
                        ? isEn
                          ? 'Loading records...'
                          : 'তথ্য লোড হচ্ছে...'
                        : isEn
                          ? `${records.length} record(s) ready`
                          : `মোট ${records.length}টি রেকর্ড প্রস্তুত`}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => idToken && void fetchRecords(idToken)}
                    disabled={loadingRecords}
                    className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 font-medium text-[#334155] hover:bg-slate-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loadingRecords ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isEn ? 'Refresh' : 'রিফ্রেশ'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 font-medium text-[#475569] hover:text-red-600"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isEn ? 'Sign Out' : 'লগআউট'}</span>
                  </button>
                </div>
              </div>

              {/* Explicit Confirmation Dialog before writing to Google Sheets */}
              {pendingConfirm ? (
                <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-5">
                  <h3 className="font-serif text-base font-bold text-[#0F172A]">
                    {isEn ? 'Confirm Google Sheet Update' : 'Google Sheet-এ ডাটা লেখার অনুমতি নিশ্চিত করুন'}
                  </h3>
                  <p className="text-sm text-[#334155]">
                    {pendingConfirm.mode === 'create'
                      ? isEn
                        ? `Create a new Google Sheet named "${pendingConfirm.title}" and write ${pendingConfirm.rowCount} record(s) into it?`
                        : `"${pendingConfirm.title}" নামে একটি নতুন Google Sheet তৈরি করে মোট ${pendingConfirm.rowCount}টি সারি (নাম, পিতার নাম, মোবাইল, ইমেইল ও পাসওয়ার্ড হ্যাশ) যুক্ত করতে চান?`
                      : isEn
                        ? `Update tab "${pendingConfirm.tabName}" in "${pendingConfirm.spreadsheetTitle}" with ${pendingConfirm.rowCount} record(s)? Existing values in that tab will be replaced with the latest complete table.`
                        : `"${pendingConfirm.spreadsheetTitle}" ফাইলের "${pendingConfirm.tabName}" ট্যাবে মোট ${pendingConfirm.rowCount}টি রেকর্ড আপডেট করতে চান? ওই ট্যাবের পূর্বের তথ্যগুলো সর্বশেষ পূর্ণাঙ্গ তালিকা দিয়ে প্রতিস্থাপিত হবে।`}
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={() => setPendingConfirm(null)}
                      className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-slate-50"
                    >
                      {isEn ? 'Cancel' : 'বাতিল'}
                    </button>
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={executeConfirmedSync}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#065F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60"
                    >
                      {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      <span>
                        {syncing
                          ? isEn
                            ? 'Syncing...'
                            : 'যুক্ত হচ্ছে...'
                          : isEn
                            ? 'Confirm & Sync'
                            : 'হ্যাঁ, যুক্ত করুন'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Option 1: Create a new Google Sheet */}
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      {isEn
                        ? 'Option 1: Create a New Google Sheet'
                        : 'বিকল্প ১: নতুন Google Sheet তৈরি করে সব ডাটা যুক্ত করুন'}
                    </h3>
                    <p className="mt-1 text-xs text-[#475569]">
                      {isEn
                        ? 'Automatically creates a formatted Google Sheet in your Google account with all rows.'
                        : 'স্বয়ংক্রিয়ভাবে আপনার Google অ্যাকাউন্টে হেডারসহ একটি নতুন শিট তৈরি করে সব সারি বসিয়ে দেবে।'}
                    </p>
                    <button
                      type="button"
                      disabled={loadingRecords}
                      onClick={handleRequestCreateSheet}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#065F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60"
                    >
                      <PlusCircle className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isEn
                          ? 'Create New Sheet & Sync All Data'
                          : 'নতুন Google Sheet তৈরি ও সিঙ্ক করুন'}
                      </span>
                    </button>
                  </div>

                  {/* Option 2: Sync to Existing Google Sheet */}
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      {isEn
                        ? 'Option 2: Update an Existing Google Sheet'
                        : 'বিকল্প ২: আপনার বিদ্যমান Google Sheet-এ যুক্ত করুন'}
                    </h3>
                    <p className="mt-1 text-xs text-[#475569]">
                      {isEn
                        ? 'Paste your Google Sheet link or Spreadsheet ID, load its tabs, and choose which tab to update.'
                        : 'আপনার Google Sheet-এর লিংক বা ID এখানে পেস্ট করে ট্যাব নির্বাচন করুন।'}
                    </p>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={sheetInput}
                        onChange={(e) => setSheetInput(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#065F46] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={loadingMeta || !sheetInput.trim()}
                        onClick={handleLoadSpreadsheetMetadata}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#065F46] bg-white px-3.5 py-2 text-xs font-semibold text-[#065F46] hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {loadingMeta && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        <span>{isEn ? 'Load Sheet Tabs' : 'ট্যাব লোড করুন'}</span>
                      </button>
                    </div>

                    {availableTabs.length > 0 && (
                      <div className="mt-3 space-y-2.5 rounded-lg bg-[#F8FAFC] p-3">
                        <p className="text-xs font-medium text-[#334155]">
                          {isEn ? 'Spreadsheet:' : 'ফাইল:'}{' '}
                          <span className="font-bold text-[#0F172A]">{spreadsheetTitle}</span>
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={selectedTab}
                            onChange={(e) => setSelectedTab(e.target.value)}
                            className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                          >
                            {availableTabs.map((tab) => (
                              <option key={tab} value={tab}>
                                {tab}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedTab || loadingRecords}
                            onClick={handleRequestUpdateSheet}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#065F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-50"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isEn ? 'Sync to Selected Tab' : 'এই ট্যাবে যুক্ত করুন'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
