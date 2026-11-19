import type { AdmissionSubmission } from '../data/madrasaData';
import type { StudentUser } from '../data/studentPortalData';

export interface SavedSheetsConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  admissionTab: string;
  studentTab: string;
}

const SHEETS_CONFIG_STORAGE_KEY = 'madrasa_sheets_config';
const LEGACY_SHEET_ID_KEY = 'madrasa_sheet_id';

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

export function quoteSheetTab(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

export function findMatchingSheet2Tab(tabs: string[]): string | undefined {
  return tabs.find((tab) => /^sheet\s*2$/i.test(tab.trim()));
}

export function getSavedSheetsConfig(): SavedSheetsConfig | null {
  try {
    const raw = localStorage.getItem(SHEETS_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedSheetsConfig>;
      if (parsed.spreadsheetId) {
        return {
          spreadsheetId: parsed.spreadsheetId,
          spreadsheetTitle: parsed.spreadsheetTitle || parsed.spreadsheetId,
          admissionTab: parsed.admissionTab || '',
          studentTab: parsed.studentTab || 'Sheet2',
        };
      }
    }
    const legacyId = localStorage.getItem(LEGACY_SHEET_ID_KEY);
    if (legacyId) {
      return {
        spreadsheetId: legacyId,
        spreadsheetTitle: legacyId,
        admissionTab: '',
        studentTab: 'Sheet2',
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function saveSheetsConfig(config: SavedSheetsConfig): void {
  try {
    localStorage.setItem(SHEETS_CONFIG_STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(LEGACY_SHEET_ID_KEY, config.spreadsheetId);
  } catch {
    // ignore storage errors
  }
}

export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
): Promise<{ title: string; tabs: string[] }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const data = (await res.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message ||
        'এই Google Sheet-এ প্রবেশ করা যায়নি। আপনার অ্যাকাউন্টে এডিট করার অনুমতি আছে কিনা যাচাই করুন।',
    );
  }

  const tabs = (data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));

  return {
    title: data.properties?.title || spreadsheetId,
    tabs,
  };
}

export async function ensureSheetTabExists(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  currentTabs: string[],
): Promise<string[]> {
  if (currentTabs.includes(tabTitle)) {
    return currentTabs;
  }

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      }),
    },
  );

  if (!batchRes.ok) {
    const batchErr = (await batchRes.json()) as { error?: { message?: string } };
    throw new Error(batchErr.error?.message || `"${tabTitle}" নামে নতুন শিট ট্যাব তৈরি করা যায়নি।`);
  }

  return [...currentTabs, tabTitle];
}

export function getAdmissionSheetHeader(): string[] {
  return [
    'ID',
    'ট্র্যাকিং নম্বর (Tracking ID)',
    'শিক্ষার্থীর নাম (Student Name)',
    'পিতার নাম (Father Name)',
    'জন্ম তারিখ (Date of Birth)',
    'বিভাগ (Department)',
    'জামাত / শ্রেণি (Class)',
    'আবাসিক ধরন (Residential Type)',
    'মোবাইল (Mobile)',
    'ইমেইল (Email)',
    'ঠিকানা (Address)',
    'অবস্থা (Status)',
    'জমার সময় (Submitted At)',
  ];
}

export function buildAdmissionSheetRow(submission: AdmissionSubmission): string[] {
  return [
    submission.trackingId,
    submission.trackingId,
    submission.studentName,
    submission.fatherName,
    submission.dateOfBirth ?? '',
    submission.department,
    submission.className,
    submission.residentialType,
    submission.mobile,
    submission.email ?? '',
    submission.address,
    'pending',
    submission.submittedAt || new Date().toISOString(),
  ];
}

export function getStudentSheetHeader(): string[] {
  return [
    'ID',
    'নিবন্ধন ধরন (Account Type)',
    'রোল / রেফারেন্স (Student Roll)',
    'শিক্ষার্থীর নাম (Student Name)',
    'পিতার নাম (Father Name)',
    'মোবাইল (Mobile)',
    'ইমেইল (Email)',
    'পাসওয়ার্ড হ্যাশ (Password Hash)',
    'বিভাগ (Department)',
    'জামাত / শ্রেণি (Class)',
    'অবস্থা (Status)',
    'সর্বশেষ লগইন (Last Login)',
    'নিবন্ধনের সময় (Registered At)',
  ];
}

export function buildStudentSheetRow(
  student: StudentUser,
  accountType: 'register' | 'google_signin',
): string[] {
  const nowIso = new Date().toISOString();
  return [
    student.id,
    accountType === 'google_signin' ? 'Google লগইন' : 'ছাত্র রেজিস্ট্রেশন',
    student.studentRoll,
    student.name,
    student.fatherName ?? '',
    student.phone,
    student.email,
    '',
    student.department,
    student.className,
    'active',
    nowIso,
    nowIso,
  ];
}

export async function appendRowToGoogleSheet(params: {
  accessToken: string;
  spreadsheetId: string;
  targetTab?: string;
  isStudentRegistration?: boolean;
  header: string[];
  row: string[];
}): Promise<{ resolvedTab: string; spreadsheetTitle: string; sheetUrl: string }> {
  const { accessToken, spreadsheetId, targetTab, isStudentRegistration, header, row } = params;

  const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  let resolvedTab = targetTab?.trim() || '';

  if (!resolvedTab) {
    if (isStudentRegistration) {
      resolvedTab = findMatchingSheet2Tab(meta.tabs) ?? 'Sheet2';
    } else {
      resolvedTab = meta.tabs[0] ?? '';
    }
  } else if (!isStudentRegistration && !meta.tabs.includes(resolvedTab) && meta.tabs[0]) {
    resolvedTab = meta.tabs[0];
  }

  if (!resolvedTab) {
    throw new Error('স্প্রেডশিটে কোনো ট্যাব পাওয়া যায়নি।');
  }

  await ensureSheetTabExists(accessToken, spreadsheetId, resolvedTab, meta.tabs);

  const checkRange = `${quoteSheetTab(resolvedTab)}!A1:A1`;
  const checkRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(checkRange)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  let hasHeader = false;
  if (checkRes.ok) {
    const checkData = (await checkRes.json()) as { values?: string[][] };
    hasHeader = Boolean(checkData.values && checkData.values.length > 0 && checkData.values[0]?.[0]);
  }

  if (!hasHeader) {
    const writeRange = `${quoteSheetTab(resolvedTab)}!A1`;
    const putRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [header, row] }),
      },
    );
    if (!putRes.ok) {
      const err = (await putRes.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || `"${resolvedTab}" ট্যাবে ডাটা সংরক্ষণ করা যায়নি।`);
    }
  } else {
    const appendRange = `${quoteSheetTab(resolvedTab)}!A1`;
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      },
    );
    if (!appendRes.ok) {
      const err = (await appendRes.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || `"${resolvedTab}" ট্যাবে নতুন সারি যুক্ত করা যায়নি।`);
    }
  }

  return {
    resolvedTab,
    spreadsheetTitle: meta.title,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}
