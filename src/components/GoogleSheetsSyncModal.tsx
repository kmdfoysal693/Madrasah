import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
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
import {
  ensureSheetTabExists,
  extractSpreadsheetId,
  fetchSpreadsheetMetadata,
  findMatchingSheet2Tab,
  getAdmissionSheetHeader,
  getSavedSheetsConfig,
  getStudentSheetHeader,
  quoteSheetTab,
  saveSheetsConfig,
} from '../lib/googleSheetsSync';

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

type ExistingSyncMode = 'split' | 'students_only' | 'combined';

type PendingConfirmation =
  | {
      mode: 'create';
      title: string;
      admissionTab: string;
      studentTab: string;
      admissionCount: number;
      studentCount: number;
    }
  | {
      mode: 'update';
      syncMode: ExistingSyncMode;
      spreadsheetId: string;
      spreadsheetTitle: string;
      admissionTab: string;
      studentTab: string;
      needsCreateStudentTab: boolean;
      combinedTab: string;
      admissionCount: number;
      studentCount: number;
      totalCount: number;
    };

const APPS_SCRIPT_CODE = `function doPost(e) {
  var payload = JSON.parse(e.postData.contents || '{}');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var isStudent = payload.targetSheet === 'Sheet2';
  var sheet = isStudent
    ? (ss.getSheetByName('Sheet2') || ss.insertSheet('Sheet2'))
    : ss.getSheets()[0];

  if (sheet.getLastRow() === 0 && payload.headers) {
    sheet.appendRow(payload.headers);
    sheet.setFrozenRows(1);
  }
  if (payload.row) {
    sheet.appendRow(payload.row);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

function formatRecordTypeLabel(type: string, lang: Language): string {
  if (lang === 'en') {
    if (type === 'online_admission') return 'Online Admission';
    if (type === 'google_signin') return 'Google Sign-In';
    if (type === 'student_account') return 'Student Registration';
    return type;
  }
  if (type === 'online_admission') return 'অনলাইন ভর্তি আবেদন';
  if (type === 'google_signin') return 'Google লগইন';
  if (type === 'student_account') return 'ছাত্র রেজিস্ট্রেশন';
  return type;
}

function isStudentRegistrationRecord(record: UnifiedExportRecord): boolean {
  return record.recordType === 'student_account' || record.recordType === 'google_signin';
}

export function GoogleSheetsSyncModal({ isOpen, lang, onClose }: GoogleSheetsSyncModalProps) {
  const isEn = lang === 'en';
  const [sheetsUser, setSheetsUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getSheetsAccessToken());
  const [idToken, setIdToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [records, setRecords] = useState<UnifiedExportRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const initialConfig = getSavedSheetsConfig();
  const [sheetInput, setSheetInput] = useState(initialConfig?.spreadsheetId ?? '');
  const [spreadsheetTitle, setSpreadsheetTitle] = useState(initialConfig?.spreadsheetTitle ?? '');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [syncMode, setSyncMode] = useState<ExistingSyncMode>('split');
  const [admissionTab, setAdmissionTab] = useState(initialConfig?.admissionTab ?? '');
  const [studentTab, setStudentTab] = useState(initialConfig?.studentTab || 'Sheet2');
  const [combinedTab, setCombinedTab] = useState(initialConfig?.admissionTab ?? '');
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedSheetUrl, setSyncedSheetUrl] = useState('');
  const [syncedMessage, setSyncedMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const admissionRecords = records.filter((r) => r.recordType === 'online_admission');
  const studentRegistrationRecords = records.filter(isStudentRegistrationRecord);

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
      const parsed = text
        ? (JSON.parse(text) as { records?: UnifiedExportRecord[]; error?: string })
        : {};
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
    if (!isOpen || !sheetsUser || !accessToken || idToken) return;
    let cancelled = false;
    (async () => {
      try {
        const freshIdToken = await sheetsUser.getIdToken();
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
      const code = (err as { code?: string })?.code ?? '';
      const msg = err instanceof Error ? err.message : '';
      if (
        code !== 'auth/popup-closed-by-user' &&
        code !== 'auth/cancelled-popup-request' &&
        !msg.includes('popup-closed-by-user')
      ) {
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
    setPendingConfirm(null);
    setSyncedMessage('');
    setSyncedSheetUrl('');
  };

  const buildAdmissionRows = (rows: UnifiedExportRecord[]): string[][] => {
    const header = getAdmissionSheetHeader();
    const body = rows.map((r) => [
      String(r.id),
      r.referenceCode,
      r.name,
      r.fatherName,
      r.dateOfBirth,
      r.department,
      r.className,
      r.residentialType,
      r.mobile,
      r.email,
      r.address,
      r.status,
      r.createdAt,
    ]);
    return [header, ...body];
  };

  const buildStudentRegistrationRows = (rows: UnifiedExportRecord[]): string[][] => {
    const header = getStudentSheetHeader();
    const body = rows.map((r) => [
      String(r.id),
      formatRecordTypeLabel(r.recordType, lang),
      r.referenceCode,
      r.name,
      r.fatherName,
      r.mobile,
      r.email,
      r.passwordHash,
      r.department,
      r.className,
      r.status,
      r.lastLoginAt ?? '',
      r.createdAt,
    ]);
    return [header, ...body];
  };

  const buildCombinedRows = (rows: UnifiedExportRecord[]): string[][] => {
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
      const meta = await fetchSpreadsheetMetadata(accessToken, sid);
      const matchedSheet2 = findMatchingSheet2Tab(meta.tabs);
      const nextAdmissionTab = meta.tabs[0] ?? '';
      const nextStudentTab = matchedSheet2 ?? 'Sheet2';

      setSpreadsheetTitle(meta.title);
      setAvailableTabs(meta.tabs);
      setAdmissionTab(nextAdmissionTab);
      setCombinedTab(nextAdmissionTab);
      setStudentTab(nextStudentTab);

      saveSheetsConfig({
        spreadsheetId: sid,
        spreadsheetTitle: meta.title,
        admissionTab: nextAdmissionTab,
        studentTab: nextStudentTab,
      });
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
    const admCount = latest.filter((r) => r.recordType === 'online_admission').length;
    const stuCount = latest.filter(isStudentRegistrationRecord).length;

    setPendingConfirm({
      mode: 'create',
      title: 'Darus Salam Madrasa — Student & Admission Records',
      admissionTab: 'OnlineAdmissions',
      studentTab: 'Sheet2',
      admissionCount: admCount,
      studentCount: stuCount,
    });
  };

  const handleRequestUpdateSheet = async () => {
    if (!sheetsUser) return;
    const sid = extractSpreadsheetId(sheetInput);
    if (!sid) return;
    if (syncMode === 'split' && (!admissionTab || !studentTab)) return;
    if (syncMode === 'students_only' && !studentTab) return;
    if (syncMode === 'combined' && !combinedTab) return;

    setErrorMsg('');
    setSyncedMessage('');
    const latestIdToken = idToken || (await sheetsUser.getIdToken());
    const latest = await fetchRecords(latestIdToken);
    const admCount = latest.filter((r) => r.recordType === 'online_admission').length;
    const stuCount = latest.filter(isStudentRegistrationRecord).length;
    const needsCreateStudentTab =
      (syncMode === 'split' || syncMode === 'students_only') && !availableTabs.includes(studentTab);

    setPendingConfirm({
      mode: 'update',
      syncMode,
      spreadsheetId: sid,
      spreadsheetTitle: spreadsheetTitle || sid,
      admissionTab,
      studentTab,
      needsCreateStudentTab,
      combinedTab,
      admissionCount: admCount,
      studentCount: stuCount,
      totalCount: latest.length,
    });
  };

  const writeValuesToTab = async (
    spreadsheetId: string,
    tabTitle: string,
    values: string[][],
  ) => {
    const clearRange = `${quoteSheetTab(tabTitle)}!A:Z`;
    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(clearRange)}:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!clearRes.ok) {
      const clearErr = (await clearRes.json()) as { error?: { message?: string } };
      throw new Error(clearErr.error?.message || `"${tabTitle}" ট্যাব প্রস্তুত করা যায়নি।`);
    }

    const writeRange = `${quoteSheetTab(tabTitle)}!A1`;
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
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
      throw new Error(updateErr.error?.message || `"${tabTitle}" ট্যাবে ডাটা লেখা যায়নি।`);
    }
  };

  const executeConfirmedSync = async () => {
    if (!pendingConfirm || !accessToken) return;
    setSyncing(true);
    setErrorMsg('');
    try {
      const admRows = buildAdmissionRows(admissionRecords);
      const stuRows = buildStudentRegistrationRows(studentRegistrationRecords);
      const allRows = buildCombinedRows(records);

      if (pendingConfirm.mode === 'create') {
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
                  title: pendingConfirm.admissionTab,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
              {
                properties: {
                  title: pendingConfirm.studentTab,
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

        await writeValuesToTab(created.spreadsheetId, pendingConfirm.admissionTab, admRows);
        await writeValuesToTab(created.spreadsheetId, pendingConfirm.studentTab, stuRows);

        setSheetInput(created.spreadsheetId);
        setSpreadsheetTitle(pendingConfirm.title);
        setAvailableTabs([pendingConfirm.admissionTab, pendingConfirm.studentTab]);
        setAdmissionTab(pendingConfirm.admissionTab);
        setStudentTab(pendingConfirm.studentTab);
        setCombinedTab(pendingConfirm.admissionTab);

        saveSheetsConfig({
          spreadsheetId: created.spreadsheetId,
          spreadsheetTitle: pendingConfirm.title,
          admissionTab: pendingConfirm.admissionTab,
          studentTab: pendingConfirm.studentTab,
        });

        const url =
          created.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`;
        setSyncedSheetUrl(url);
        setSyncedMessage(
          isEn
            ? `Created new Google Sheet with "${pendingConfirm.admissionTab}" (${admissionRecords.length} admissions) and "${pendingConfirm.studentTab}" (${studentRegistrationRecords.length} student registrations).`
            : `নতুন Google Sheet তৈরি হয়েছে: "${pendingConfirm.admissionTab}" ট্যাবে ${admissionRecords.length}টি ভর্তি আবেদন এবং "${pendingConfirm.studentTab}" ট্যাবে ${studentRegistrationRecords.length}টি ছাত্র রেজিস্ট্রেশন সংরক্ষিত হয়েছে!`,
        );
      } else {
        let updatedTabs = [...availableTabs];

        if (pendingConfirm.syncMode === 'split') {
          if (pendingConfirm.studentTab !== pendingConfirm.admissionTab) {
            updatedTabs = await ensureSheetTabExists(
              accessToken,
              pendingConfirm.spreadsheetId,
              pendingConfirm.studentTab,
              updatedTabs,
            );
            await writeValuesToTab(
              pendingConfirm.spreadsheetId,
              pendingConfirm.admissionTab,
              admRows,
            );
            await writeValuesToTab(
              pendingConfirm.spreadsheetId,
              pendingConfirm.studentTab,
              stuRows,
            );
            setSyncedMessage(
              isEn
                ? `Synced ${admissionRecords.length} admission(s) to "${pendingConfirm.admissionTab}" and ${studentRegistrationRecords.length} student registration(s) to "${pendingConfirm.studentTab}".`
                : `"${pendingConfirm.admissionTab}" ট্যাবে ${admissionRecords.length}টি ভর্তি আবেদন এবং "${pendingConfirm.studentTab}" ট্যাবে ${studentRegistrationRecords.length}টি ছাত্র রেজিস্ট্রেশন সফলভাবে সংরক্ষিত হয়েছে!`,
            );
          } else {
            await writeValuesToTab(
              pendingConfirm.spreadsheetId,
              pendingConfirm.admissionTab,
              allRows,
            );
            setSyncedMessage(
              isEn
                ? `Synced ${records.length} record(s) to "${pendingConfirm.admissionTab}".`
                : `"${pendingConfirm.admissionTab}" ট্যাবে মোট ${records.length}টি তথ্য সফলভাবে যুক্ত করা হয়েছে!`,
            );
          }
          saveSheetsConfig({
            spreadsheetId: pendingConfirm.spreadsheetId,
            spreadsheetTitle: pendingConfirm.spreadsheetTitle,
            admissionTab: pendingConfirm.admissionTab,
            studentTab: pendingConfirm.studentTab,
          });
        } else if (pendingConfirm.syncMode === 'students_only') {
          updatedTabs = await ensureSheetTabExists(
            accessToken,
            pendingConfirm.spreadsheetId,
            pendingConfirm.studentTab,
            updatedTabs,
          );
          await writeValuesToTab(pendingConfirm.spreadsheetId, pendingConfirm.studentTab, stuRows);
          setSyncedMessage(
            isEn
              ? `Synced ${studentRegistrationRecords.length} student registration(s) to "${pendingConfirm.studentTab}".`
              : `"${pendingConfirm.studentTab}" ট্যাবে ${studentRegistrationRecords.length}টি ছাত্র রেজিস্ট্রেশনের তথ্য সফলভাবে সংরক্ষিত হয়েছে!`,
          );
          saveSheetsConfig({
            spreadsheetId: pendingConfirm.spreadsheetId,
            spreadsheetTitle: pendingConfirm.spreadsheetTitle,
            admissionTab: admissionTab || updatedTabs[0] || '',
            studentTab: pendingConfirm.studentTab,
          });
        } else {
          await writeValuesToTab(pendingConfirm.spreadsheetId, pendingConfirm.combinedTab, allRows);
          setSyncedMessage(
            isEn
              ? `Successfully updated "${pendingConfirm.combinedTab}" with ${records.length} record(s).`
              : `"${pendingConfirm.combinedTab}" ট্যাবে মোট ${records.length}টি তথ্য সফলভাবে যুক্ত করা হয়েছে!`,
          );
          saveSheetsConfig({
            spreadsheetId: pendingConfirm.spreadsheetId,
            spreadsheetTitle: pendingConfirm.spreadsheetTitle,
            admissionTab: pendingConfirm.combinedTab,
            studentTab: studentTab || 'Sheet2',
          });
        }

        setAvailableTabs(updatedTabs);
        const url = `https://docs.google.com/spreadsheets/d/${pendingConfirm.spreadsheetId}/edit`;
        setSyncedSheetUrl(url);
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

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const studentTabOptions = availableTabs.some((t) => /^sheet\s*2$/i.test(t.trim()))
    ? availableTabs
    : [...availableTabs, 'Sheet2'];

  const activeSavedConfig = getSavedSheetsConfig();

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
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]"
                  aria-hidden="true"
                />
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
                  ? 'Sign in with your Google account to save online admissions and student registrations directly into separate tabs (including Sheet2) of your Google Sheet.'
                  : 'অনলাইন ভর্তি আবেদন ও ছাত্র রেজিস্ট্রেশনের সকল তথ্য সরাসরি আপনার Google Sheet-এ (ছাত্র রেজিস্ট্রেশন Sheet2-এ) সংরক্ষণ করতে আপনার Google অ্যাকাউন্ট দিয়ে সাইন-ইন করুন।'}
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
                  <span>
                    {signingIn
                      ? isEn
                        ? 'Connecting...'
                        : 'সংযুক্ত হচ্ছে...'
                      : 'Sign in with Google'}
                  </span>
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
                          ? `${admissionRecords.length} admission(s), ${studentRegistrationRecords.length} student registration(s)`
                          : `ভর্তি আবেদন: ${admissionRecords.length}টি · ছাত্র রেজিস্ট্রেশন: ${studentRegistrationRecords.length}টি`}
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

              {activeSavedConfig?.spreadsheetId && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-950">
                  <span className="font-semibold text-[#065F46]">
                    {isEn ? 'Linked Sheet Active:' : 'লিংক করা শিট সক্রিয়:'}
                  </span>{' '}
                  {activeSavedConfig.spreadsheetTitle} —{' '}
                  {isEn
                    ? `New forms can save straight to "${activeSavedConfig.admissionTab || 'Tab 1'}" & "${activeSavedConfig.studentTab || 'Sheet2'}".`
                    : `এখন নতুন ফর্ম পূরণ করলেই সরাসরি "${activeSavedConfig.admissionTab || '১ম ট্যাব'}" ও "${activeSavedConfig.studentTab || 'Sheet2'}"-এ সেভ করতে পারবেন।`}
                </div>
              )}

              {/* Explicit Confirmation Dialog before writing to Google Sheets */}
              {pendingConfirm ? (
                <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-5">
                  <h3 className="font-serif text-base font-bold text-[#0F172A]">
                    {isEn
                      ? 'Confirm Google Sheet Update'
                      : 'Google Sheet-এ ডাটা লেখার অনুমতি নিশ্চিত করুন'}
                  </h3>
                  <div className="space-y-2 text-sm text-[#334155]">
                    {pendingConfirm.mode === 'create' ? (
                      <p>
                        {isEn
                          ? `Create a new Google Sheet named "${pendingConfirm.title}" with two tabs: "${pendingConfirm.admissionTab}" (${pendingConfirm.admissionCount} online admissions) and "${pendingConfirm.studentTab}" (${pendingConfirm.studentCount} student registrations)?`
                          : `"${pendingConfirm.title}" নামে একটি নতুন Google Sheet তৈরি করে "${pendingConfirm.admissionTab}" ট্যাবে ${pendingConfirm.admissionCount}টি ভর্তি আবেদন এবং "${pendingConfirm.studentTab}" ট্যাবে ${pendingConfirm.studentCount}টি ছাত্র রেজিস্ট্রেশন সংরক্ষণ করতে চান?`}
                      </p>
                    ) : pendingConfirm.syncMode === 'split' ? (
                      <>
                        <p>
                          {isEn
                            ? `Update "${pendingConfirm.spreadsheetTitle}" as follows:`
                            : `"${pendingConfirm.spreadsheetTitle}" ফাইলে নিচের ট্যাবগুলোতে ডাটা সংরক্ষণ করতে চান?`}
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-xs text-[#0F172A]">
                          <li>
                            {isEn
                              ? `Tab "${pendingConfirm.admissionTab}": ${pendingConfirm.admissionCount} Online Admission record(s)`
                              : `"${pendingConfirm.admissionTab}" ট্যাবে: ${pendingConfirm.admissionCount}টি অনলাইন ভর্তি আবেদন`}
                          </li>
                          <li>
                            {isEn
                              ? `Tab "${pendingConfirm.studentTab}": ${pendingConfirm.studentCount} Student Registration record(s)${pendingConfirm.needsCreateStudentTab ? ' (new tab will be created automatically)' : ''}`
                              : `"${pendingConfirm.studentTab}" ট্যাবে: ${pendingConfirm.studentCount}টি ছাত্র রেজিস্ট্রেশন${pendingConfirm.needsCreateStudentTab ? ' (এই নামে নতুন ট্যাব স্বয়ংক্রিয়ভাবে তৈরি হবে)' : ''}`}
                          </li>
                        </ul>
                        <p className="text-xs text-[#475569]">
                          {isEn
                            ? 'Existing values in those tab(s) will be updated with the latest records.'
                            : 'সংশ্লিষ্ট ট্যাবের পূর্বের তথ্যগুলো সর্বশেষ পূর্ণাঙ্গ তালিকা দিয়ে আপডেট হবে।'}
                        </p>
                      </>
                    ) : pendingConfirm.syncMode === 'students_only' ? (
                      <p>
                        {isEn
                          ? `Save ${pendingConfirm.studentCount} student registration record(s) into "${pendingConfirm.studentTab}" of "${pendingConfirm.spreadsheetTitle}"${pendingConfirm.needsCreateStudentTab ? ' (creating the tab automatically)' : ''}?`
                          : `"${pendingConfirm.spreadsheetTitle}" ফাইলের "${pendingConfirm.studentTab}" ট্যাবে ${pendingConfirm.studentCount}টি ছাত্র রেজিস্ট্রেশনের তথ্য সংরক্ষণ করতে চান?${pendingConfirm.needsCreateStudentTab ? ` ("${pendingConfirm.studentTab}" ট্যাব না থাকায় নতুন করে তৈরি করা হবে)` : ''}`}
                      </p>
                    ) : (
                      <p>
                        {isEn
                          ? `Update tab "${pendingConfirm.combinedTab}" in "${pendingConfirm.spreadsheetTitle}" with all ${pendingConfirm.totalCount} record(s)? Existing values in that tab will be replaced.`
                          : `"${pendingConfirm.spreadsheetTitle}" ফাইলের "${pendingConfirm.combinedTab}" ট্যাবে মোট ${pendingConfirm.totalCount}টি রেকর্ড আপডেট করতে চান? ওই ট্যাবের পূর্বের তথ্যগুলো সর্বশেষ তালিকা দিয়ে প্রতিস্থাপিত হবে।`}
                      </p>
                    )}
                  </div>
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
                        ? 'Option 1: Create a New Google Sheet (with Sheet2 for Student Registrations)'
                        : 'বিকল্প ১: নতুন Google Sheet তৈরি (ভর্তি আবেদন + ছাত্র রেজিস্ট্রেশন Sheet2-এ)'}
                    </h3>
                    <p className="mt-1 text-xs text-[#475569]">
                      {isEn
                        ? 'Creates a new spreadsheet with "OnlineAdmissions" tab for admissions and "Sheet2" for student registrations.'
                        : 'স্বয়ংক্রিয়ভাবে একই ফাইলে "OnlineAdmissions" ট্যাবে ভর্তি আবেদন এবং "Sheet2" ট্যাবে ছাত্র রেজিস্ট্রেশনের তথ্য সংরক্ষণ করবে।'}
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
                          ? 'Create New Sheet & Sync Both Tabs'
                          : 'নতুন Google Sheet তৈরি ও সিঙ্ক করুন'}
                      </span>
                    </button>
                  </div>

                  {/* Option 2: Sync to Existing Google Sheet */}
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      {isEn
                        ? 'Option 2: Link & Update an Existing Google Sheet'
                        : 'বিকল্প ২: আপনার বিদ্যমান Google Sheet লিংক ও আপডেট করুন'}
                    </h3>
                    <p className="mt-1 text-xs text-[#475569]">
                      {isEn
                        ? 'Paste your Google Sheet link or ID, load tabs, and save student registrations into Sheet2 of the same file.'
                        : 'আপনার Google Sheet-এর লিংক বা ID পেস্ট করে ট্যাব লোড করুন এবং একই ফাইলের Sheet2-এ ছাত্র রেজিস্ট্রেশন সেভ করুন।'}
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
                      <div className="mt-3 space-y-3 rounded-lg bg-[#F8FAFC] p-3.5">
                        <p className="text-xs font-medium text-[#334155]">
                          {isEn ? 'Spreadsheet:' : 'ফাইল:'}{' '}
                          <span className="font-bold text-[#0F172A]">{spreadsheetTitle}</span>
                        </p>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-[#334155]">
                            {isEn ? 'Sync Mode' : 'সংরক্ষণের ধরন'}
                          </label>
                          <select
                            value={syncMode}
                            onChange={(e) => setSyncMode(e.target.value as ExistingSyncMode)}
                            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                          >
                            <option value="split">
                              {isEn
                                ? 'Separate Tabs: Admissions → Tab 1 & Student Registrations → Sheet2'
                                : 'আলাদা ট্যাব: ভর্তি আবেদন → ১ম শিট ও ছাত্র রেজিস্ট্রেশন → Sheet2'}
                            </option>
                            <option value="students_only">
                              {isEn
                                ? 'Student Registrations Only → Sheet2'
                                : 'শুধুমাত্র ছাত্র রেজিস্ট্রেশন → Sheet2'}
                            </option>
                            <option value="combined">
                              {isEn
                                ? 'All Records Together → Single Tab'
                                : 'সকল তথ্য একসাথে একটি ট্যাবে'}
                            </option>
                          </select>
                        </div>

                        {syncMode === 'split' && (
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-[#334155]">
                                {isEn
                                  ? `Online Admissions (${admissionRecords.length})`
                                  : `ভর্তি আবেদন ট্যাব (${admissionRecords.length}টি)`}
                              </label>
                              <select
                                value={admissionTab}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setAdmissionTab(next);
                                  const sid = extractSpreadsheetId(sheetInput);
                                  if (sid) {
                                    saveSheetsConfig({
                                      spreadsheetId: sid,
                                      spreadsheetTitle: spreadsheetTitle || sid,
                                      admissionTab: next,
                                      studentTab,
                                    });
                                  }
                                }}
                                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                              >
                                {availableTabs.map((tab) => (
                                  <option key={tab} value={tab}>
                                    {tab}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-[#065F46]">
                                {isEn
                                  ? `Student Registrations (${studentRegistrationRecords.length})`
                                  : `ছাত্র রেজিস্ট্রেশন ট্যাব (${studentRegistrationRecords.length}টি)`}
                              </label>
                              <select
                                value={studentTab}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setStudentTab(next);
                                  const sid = extractSpreadsheetId(sheetInput);
                                  if (sid) {
                                    saveSheetsConfig({
                                      spreadsheetId: sid,
                                      spreadsheetTitle: spreadsheetTitle || sid,
                                      admissionTab,
                                      studentTab: next,
                                    });
                                  }
                                }}
                                className="w-full rounded-lg border border-[#065F46]/40 bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                              >
                                {studentTabOptions.map((tab) => (
                                  <option key={tab} value={tab}>
                                    {tab}
                                    {!availableTabs.includes(tab)
                                      ? isEn
                                        ? ' (Will be created)'
                                        : ' (নতুন তৈরি হবে)'
                                      : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {syncMode === 'students_only' && (
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-[#065F46]">
                              {isEn
                                ? `Target Tab for Student Registrations (${studentRegistrationRecords.length})`
                                : `ছাত্র রেজিস্ট্রেশনের জন্য ট্যাব (${studentRegistrationRecords.length}টি)`}
                            </label>
                            <select
                              value={studentTab}
                              onChange={(e) => setStudentTab(e.target.value)}
                              className="w-full rounded-lg border border-[#065F46]/40 bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                            >
                              {studentTabOptions.map((tab) => (
                                <option key={tab} value={tab}>
                                  {tab}
                                  {!availableTabs.includes(tab)
                                    ? isEn
                                      ? ' (Will be created)'
                                      : ' (নতুন তৈরি হবে)'
                                    : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {syncMode === 'combined' && (
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-[#334155]">
                              {isEn
                                ? `Target Tab (All ${records.length} Records)`
                                : `সব তথ্যের ট্যাব (মোট ${records.length}টি)`}
                            </label>
                            <select
                              value={combinedTab}
                              onChange={(e) => setCombinedTab(e.target.value)}
                              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                            >
                              {availableTabs.map((tab) => (
                                <option key={tab} value={tab}>
                                  {tab}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={loadingRecords}
                          onClick={handleRequestUpdateSheet}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#065F46] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-50"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {syncMode === 'split'
                              ? isEn
                                ? `Sync Admissions & Student Registrations (${studentTab})`
                                : `ভর্তি আবেদন ও ছাত্র রেজিস্ট্রেশন (${studentTab}) সিঙ্ক করুন`
                              : syncMode === 'students_only'
                                ? isEn
                                  ? `Save Student Registrations to ${studentTab}`
                                  : `${studentTab}-এ ছাত্র রেজিস্ট্রেশন সেভ করুন`
                                : isEn
                                  ? `Sync All Data to ${combinedTab}`
                                  : `${combinedTab} ট্যাবে সব ডাটা যুক্ত করুন`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Optional 24/7 Server Webhook Guide (Google Apps Script) */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                    <button
                      type="button"
                      onClick={() => setShowWebhookGuide((prev) => !prev)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-[#0F172A]"
                    >
                      <span>
                        {isEn
                          ? 'Optional: 24/7 Background Auto-Save from Any Device (Apps Script)'
                          : 'ঐচ্ছিক: যেকোনো ভিজিটরের ফর্ম পূরণে ২৪ ঘণ্টা অটো-সেভ (Apps Script গাইড)'}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-[#475569] transition-transform ${showWebhookGuide ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {showWebhookGuide && (
                      <div className="space-y-3 border-t border-[#E2E8F0] px-4 py-3 text-xs text-[#334155]">
                        <p>
                          {isEn
                            ? 'If students fill out forms from their own phones without your Google login, deploy this short script inside your Google Sheet (Extensions → Apps Script → Deploy as Web App, Who has access: Anyone) and set GOOGLE_SHEETS_WEBHOOK_URL in AI Studio Secrets:'
                            : 'ছাত্ররা নিজেদের মোবাইল থেকে ফর্ম পূরণ করলেও যেন লগইন ছাড়াই সরাসরি শিটে সেভ হয়, সেজন্য আপনার Google Sheet-এ (Extensions → Apps Script → Deploy as Web App, Access: Anyone) নিচের কোডটি দিয়ে Web App URL-টি AI Studio Secrets-এ GOOGLE_SHEETS_WEBHOOK_URL হিসেবে যুক্ত করুন:'}
                        </p>
                        <div className="relative">
                          <pre className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                            {APPS_SCRIPT_CODE}
                          </pre>
                          <button
                            type="button"
                            onClick={handleCopyScript}
                            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/20"
                          >
                            {copiedScript ? (
                              <>
                                <Check className="h-3 w-3" aria-hidden="true" />
                                <span>{isEn ? 'Copied' : 'কপি হয়েছে'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                <span>{isEn ? 'Copy' : 'কপি করুন'}</span>
                              </>
                            )}
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
