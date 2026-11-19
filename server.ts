import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ExamResultTerm,
  ExamRoutineItem,
  StudentDashboardPayload,
  StudentUser,
  TuitionRecord,
} from './src/data/studentPortalData.ts';
import type {
  AdmissionStatus,
  CmsDepartment,
  CmsGalleryItem,
  CmsNotice,
  CmsTeacherProfile,
  HeroSectionCms,
  NoticeStatus,
  AboutSectionCms,
  SiteCmsData,
  SiteSettingsCms,
  StoredAdmissionRecord,
} from './src/data/cmsTypes.ts';
import { createDefaultCmsData } from './src/data/defaultCmsSeed.ts';
import { isSqlConfigured } from './src/db/index.ts';
import { getUsers } from './src/db/users.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  deleteAdmissionDb,
  deleteCmsStateValueDb,
  findAdmissionByTrackingIdDb,
  findStudentByFirebaseUidOrEmailDb,
  findStudentByIdDb,
  findStudentByPhoneDb,
  findStudentByPhoneOrEmailDb,
  getCmsStateValueDb,
  insertAdmissionDb,
  insertStudentDb,
  listAdmissionsDb,
  listStudentsDb,
  listUnifiedMadrasaRecords,
  recordStudentLoginDb,
  setCmsStateValueDb,
  updateAdmissionDb,
  updateStudentTuitionDb,
  type UnifiedMadrasaRecord,
} from './src/db/madrasaDb.ts';

interface StoredStudentRecord {
  id: string;
  studentRoll: string;
  firebaseUid?: string;
  name: string;
  fatherName?: string;
  email: string;
  phone: string;
  department: string;
  className: string;
  session: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string | null;
  tuitionRecords: TuitionRecord[];
  examRoutine: ExamRoutineItem[];
  examResults: ExamResultTerm[];
}

interface StudentDatabase {
  students: StoredStudentRecord[];
}

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'students.json');
const CMS_FILE = path.join(DATA_DIR, 'cms.json');
const ADMISSIONS_FILE = path.join(DATA_DIR, 'admissions.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const ADMIN_UI_FILE = path.join(DATA_DIR, 'admin_ui.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SECRET_FILE = path.join(DATA_DIR, '.session_secret');

const CMS_STATE_KEYS = {
  siteCms: 'site_cms',
  adminAuth: 'admin_auth',
  adminUi: 'admin_ui',
} as const;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    ensureDataDir();
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, 'utf8');
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = getSessionSecret();

function readDatabase(): StudentDatabase {
  try {
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
      return { students: [] };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StudentDatabase;
    return Array.isArray(parsed.students) ? parsed : { students: [] };
  } catch {
    return { students: [] };
  }
}

function writeDatabase(db: StudentDatabase) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function mergeCmsWithDefaults(parsed: Partial<SiteCmsData> | null | undefined): SiteCmsData {
  const fallback = createDefaultCmsData();
  if (!parsed) return fallback;
  return {
    siteSettings: { ...fallback.siteSettings, ...(parsed.siteSettings ?? {}) },
    heroSection: {
      ...fallback.heroSection,
      ...(parsed.heroSection ?? {}),
      slides: Array.isArray(parsed.heroSection?.slides)
        ? parsed.heroSection.slides
        : fallback.heroSection.slides,
      stats: Array.isArray(parsed.heroSection?.stats)
        ? parsed.heroSection.stats
        : fallback.heroSection.stats,
    },
    aboutSection: {
      ...fallback.aboutSection,
      ...(parsed.aboutSection ?? {}),
      coreValues: Array.isArray(parsed.aboutSection?.coreValues)
        ? parsed.aboutSection.coreValues
        : fallback.aboutSection.coreValues,
    },
    departments: Array.isArray(parsed.departments) ? parsed.departments : fallback.departments,
    notices: Array.isArray(parsed.notices) ? parsed.notices : fallback.notices,
    gallery: Array.isArray(parsed.gallery) ? parsed.gallery : fallback.gallery,
    teachers: Array.isArray(parsed.teachers) ? parsed.teachers : fallback.teachers,
    updatedAt: parsed.updatedAt ?? fallback.updatedAt,
  };
}

function readCmsFileDatabase(): SiteCmsData {
  try {
    ensureDataDir();
    if (!fs.existsSync(CMS_FILE)) {
      const seeded = createDefaultCmsData();
      fs.writeFileSync(CMS_FILE, JSON.stringify(seeded, null, 2), 'utf8');
      return seeded;
    }
    const raw = fs.readFileSync(CMS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SiteCmsData>;
    return mergeCmsWithDefaults(parsed);
  } catch {
    return createDefaultCmsData();
  }
}

async function loadCmsDatabase(): Promise<SiteCmsData> {
  if (isSqlConfigured()) {
    const stored = await getCmsStateValueDb<Partial<SiteCmsData>>(CMS_STATE_KEYS.siteCms);
    if (stored) {
      return mergeCmsWithDefaults(stored);
    }
    const seeded = createDefaultCmsData();
    await setCmsStateValueDb(CMS_STATE_KEYS.siteCms, seeded as unknown as Record<string, unknown>);
    return seeded;
  }
  return readCmsFileDatabase();
}

const cmsStreamClients = new Set<Response>();

function broadcastCmsUpdateToClients(cms: SiteCmsData) {
  if (cmsStreamClients.size === 0) return;
  const payload = `event: cms-updated\ndata: ${JSON.stringify({ cms })}\n\n`;
  for (const client of cmsStreamClients) {
    try {
      client.write(payload);
    } catch {
      cmsStreamClients.delete(client);
    }
  }
}

async function saveCmsDatabase(cms: SiteCmsData): Promise<void> {
  cms.updatedAt = new Date().toISOString();
  if (isSqlConfigured()) {
    await setCmsStateValueDb(CMS_STATE_KEYS.siteCms, cms as unknown as Record<string, unknown>);
  } else {
    ensureDataDir();
    fs.writeFileSync(CMS_FILE, JSON.stringify(cms, null, 2), 'utf8');
  }
  broadcastCmsUpdateToClients(cms);
}

interface AdmissionsDatabase {
  admissions: StoredAdmissionRecord[];
}

function readAdmissionsDatabase(): AdmissionsDatabase {
  try {
    ensureDataDir();
    if (!fs.existsSync(ADMISSIONS_FILE)) {
      return { admissions: [] };
    }
    const raw = fs.readFileSync(ADMISSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AdmissionsDatabase;
    return Array.isArray(parsed.admissions) ? parsed : { admissions: [] };
  } catch {
    return { admissions: [] };
  }
}

function writeAdmissionsDatabase(data: AdmissionsDatabase) {
  ensureDataDir();
  fs.writeFileSync(ADMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

interface AdminCredentialStore {
  username: string;
  passwordSalt: string;
  passwordHash: string;
}

function readOrInitAdminFileStore(): AdminCredentialStore {
  ensureDataDir();
  try {
    if (fs.existsSync(ADMIN_FILE)) {
      const raw = fs.readFileSync(ADMIN_FILE, 'utf8');
      const parsed = JSON.parse(raw) as AdminCredentialStore;
      if (parsed.username && parsed.passwordSalt && parsed.passwordHash) {
        return parsed;
      }
    }
  } catch {
    // re-seed below
  }
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const initialPassword = process.env.ADMIN_PASSWORD || 'madrasa1448';
  const { salt, hash } = hashPassword(initialPassword);
  const store: AdminCredentialStore = {
    username,
    passwordSalt: salt,
    passwordHash: hash,
  };
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(store, null, 2), 'utf8');
  return store;
}

async function loadOrInitAdminStore(): Promise<AdminCredentialStore> {
  if (isSqlConfigured()) {
    const existing = await getCmsStateValueDb<AdminCredentialStore>(CMS_STATE_KEYS.adminAuth);
    if (existing?.username && existing?.passwordSalt && existing?.passwordHash) {
      return existing;
    }
    const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const initialPassword = process.env.ADMIN_PASSWORD || 'madrasa1448';
    const { salt, hash } = hashPassword(initialPassword);
    const store: AdminCredentialStore = {
      username,
      passwordSalt: salt,
      passwordHash: hash,
    };
    await setCmsStateValueDb(CMS_STATE_KEYS.adminAuth, store as unknown as Record<string, unknown>);
    return store;
  }
  return readOrInitAdminFileStore();
}

async function saveAdminStore(store: AdminCredentialStore): Promise<void> {
  if (isSqlConfigured()) {
    await setCmsStateValueDb(CMS_STATE_KEYS.adminAuth, store as unknown as Record<string, unknown>);
    return;
  }
  ensureDataDir();
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function readAdminUiFileConfig(): Record<string, unknown> | null {
  try {
    ensureDataDir();
    if (!fs.existsSync(ADMIN_UI_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(ADMIN_UI_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function loadAdminUiConfig(): Promise<Record<string, unknown> | null> {
  if (isSqlConfigured()) {
    return getCmsStateValueDb<Record<string, unknown>>(CMS_STATE_KEYS.adminUi);
  }
  return readAdminUiFileConfig();
}

async function saveAdminUiConfig(config: Record<string, unknown>): Promise<void> {
  if (isSqlConfigured()) {
    await setCmsStateValueDb(CMS_STATE_KEYS.adminUi, config);
    return;
  }
  ensureDataDir();
  fs.writeFileSync(ADMIN_UI_FILE, JSON.stringify(config, null, 2), 'utf8');
}

async function resetAdminUiConfig(): Promise<void> {
  if (isSqlConfigured()) {
    await deleteCmsStateValueDb(CMS_STATE_KEYS.adminUi);
    return;
  }
  try {
    if (fs.existsSync(ADMIN_UI_FILE)) {
      fs.unlinkSync(ADMIN_UI_FILE);
    }
  } catch {
    // ignore
  }
}

const BENGALI_TO_ASCII_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function normalizePhone(rawPhone: string): string {
  const ascii = rawPhone.replace(/[০-৯]/g, (ch) => BENGALI_TO_ASCII_DIGITS[ch] ?? ch);
  let cleaned = ascii.replace(/[\s()-]/g, '').trim();
  if (cleaned.startsWith('+8801')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('8801')) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const effectiveSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, effectiveSalt, 64).toString('hex');
  return { salt: effectiveSalt, hash: derived };
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  if (!salt || !storedHash) return false;
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signToken(sub: string, role: 'student' | 'admin' = 'student'): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifyTokenPayload(token: string): { sub: string; role: 'student' | 'admin' } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      role?: 'student' | 'admin';
      exp?: number;
    };
    if (!decoded.sub || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return { sub: decoded.sub, role: decoded.role ?? 'student' };
  } catch {
    return null;
  }
}

function verifyToken(token: string): string | null {
  const parsed = verifyTokenPayload(token);
  if (!parsed || parsed.role !== 'student') return null;
  return parsed.sub;
}

function verifyAdminRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  const parsed = verifyTokenPayload(token);
  if (!parsed || parsed.role !== 'admin') return null;
  return parsed.sub;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminUser = verifyAdminRequest(req);
  if (!adminUser) {
    res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে অ্যাডমিন হিসেবে লগইন করুন।' });
    return;
  }
  next();
}

function sanitizeStudent(record: {
  id: string;
  studentRoll: string;
  name: string;
  fatherName?: string;
  email: string;
  phone: string;
  department: string;
  className: string;
  session: string;
}): StudentUser {
  return {
    id: record.id,
    studentRoll: record.studentRoll,
    name: record.name,
    fatherName: record.fatherName ?? '',
    email: record.email,
    phone: record.phone,
    department: record.department,
    className: record.className,
    session: record.session,
  };
}

function buildInitialAcademicData(studentRoll: string): {
  tuitionRecords: TuitionRecord[];
  examRoutine: ExamRoutineItem[];
  examResults: ExamResultTerm[];
} {
  const tuitionRecords: TuitionRecord[] = [
    {
      id: 'fee-jul',
      month: 'জুলাই ২০২৬',
      feeType: 'মাসিক বেতন ও আবাসিক চার্জ',
      amount: 3500,
      status: 'পরিশোধিত',
      paidDate: '০৫ জুলাই ২০২৬',
      receiptNo: `RCP-2026-${studentRoll.slice(-4)}1`,
    },
    {
      id: 'fee-aug',
      month: 'আগস্ট ২০২৬',
      feeType: 'মাসিক বেতন ও আবাসিক চার্জ',
      amount: 3500,
      status: 'পরিশোধিত',
      paidDate: '০৪ আগস্ট ২০২৬',
      receiptNo: `RCP-2026-${studentRoll.slice(-4)}2`,
    },
    {
      id: 'fee-sep',
      month: 'সেপ্টেম্বর ২০২৬',
      feeType: 'মাসিক বেতন ও আবাসিক চার্জ',
      amount: 3500,
      status: 'পরিশোধিত',
      paidDate: '০৬ সেপ্টেম্বর ২০২৬',
      receiptNo: `RCP-2026-${studentRoll.slice(-4)}3`,
    },
    {
      id: 'fee-oct',
      month: 'অক্টোবর ২০২৬',
      feeType: 'মাসিক বেতন ও পরীক্ষার ফি',
      amount: 4000,
      status: 'পরিশোধিত',
      paidDate: '০৭ অক্টোবর ২০২৬',
      receiptNo: `RCP-2026-${studentRoll.slice(-4)}4`,
    },
    {
      id: 'fee-nov',
      month: 'নভেম্বর ২০২৬',
      feeType: 'মাসিক বেতন ও আবাসিক চার্জ',
      amount: 3500,
      status: 'বকেয়া',
      paidDate: '—',
      receiptNo: '—',
    },
  ];

  const examRoutine: ExamRoutineItem[] = [
    {
      id: 'ex-1',
      date: '২৫ নভেম্বর ২০২৬',
      day: 'বুধবার',
      time: 'সকাল ৯:০০ – দুপুর ১২:০০',
      subject: 'তাফসীরে জালালাইন / কুরআনুল কারীম',
      kitabCode: 'KIT-301',
      hallAndSeat: 'দারুল হাদিস হল · আসন ১৮',
    },
    {
      id: 'ex-2',
      date: '২৮ নভেম্বর ২০২৬',
      day: 'শনিবার',
      time: 'সকাল ৯:০০ – দুপুর ১২:০০',
      subject: 'মিশকাতুল মাসাবীহ (হাদিস শরীফ)',
      kitabCode: 'KIT-302',
      hallAndSeat: 'দারুল হাদিস হল · আসন ১৮',
    },
    {
      id: 'ex-3',
      date: '৩০ নভেম্বর ২০২৬',
      day: 'সোমবার',
      time: 'সকাল ৯:০০ – দুপুর ১২:০০',
      subject: 'হিদায়া (ফিকহুল ইসলামী)',
      kitabCode: 'KIT-303',
      hallAndSeat: 'কক্ষ নং ২০৪ · আসন ১৮',
    },
    {
      id: 'ex-4',
      date: '০২ ডিসেম্বর ২০২৬',
      day: 'বুধবার',
      time: 'সকাল ৯:০০ – দুপুর ১২:০০',
      subject: 'আরবি সাহিত্য ও বালাগাত',
      kitabCode: 'KIT-304',
      hallAndSeat: 'কক্ষ নং ২০৪ · আসন ১৮',
    },
    {
      id: 'ex-5',
      date: '০৫ ডিসেম্বর ২০২৬',
      day: 'শনিবার',
      time: 'সকাল ৯:০০ – দুপুর ১১:৩০',
      subject: 'ইংরেজি, গণিত ও তথ্যপ্রযুক্তি',
      kitabCode: 'GEN-305',
      hallAndSeat: 'একাডেমিক ভবন ৩০২ · আসন ১৮',
    },
  ];

  const examResults: ExamResultTerm[] = [
    {
      id: 'term-1-2026',
      termName: '১ম সাময়িক পরীক্ষা — ২০২৬',
      publishedDate: '১৫ আগস্ট ২০২৬',
      meritPosition: '৪র্থ স্থান (মুমতায)',
      overallGrade: 'মুমতায (A+)',
      subjects: [
        {
          subject: 'তাফসীরুল কুরআন',
          fullMarks: 100,
          obtainedMarks: 92,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'হাদিস শরীফ ও উসূল',
          fullMarks: 100,
          obtainedMarks: 88,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'ফিকহ ও ফতোয়া',
          fullMarks: 100,
          obtainedMarks: 85,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'আরবি সাহিত্য ও ব্যাকরণ',
          fullMarks: 100,
          obtainedMarks: 82,
          grade: 'জায়্যিদ জিদ্দান',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'ইংরেজি ও সাধারণ গণিত',
          fullMarks: 100,
          obtainedMarks: 86,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
      ],
    },
    {
      id: 'term-annual-2025',
      termName: 'বার্ষিক কেন্দ্রীয় পরীক্ষা — ২০২৫',
      publishedDate: '২০ ডিসেম্বর ২০২৫',
      meritPosition: '৬ষ্ঠ স্থান (মুমতায)',
      overallGrade: 'মুমতায (A+)',
      subjects: [
        {
          subject: 'হিফজ ও তাজবিদ',
          fullMarks: 100,
          obtainedMarks: 94,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'শরহে বেকায়া / ফিকহ',
          fullMarks: 100,
          obtainedMarks: 84,
          grade: 'জায়্যিদ জিদ্দান',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'নাহু ও সরফ',
          fullMarks: 100,
          obtainedMarks: 81,
          grade: 'জায়্যিদ জিদ্দান',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'সীরাত ও ইসলামের ইতিহাস',
          fullMarks: 100,
          obtainedMarks: 90,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
        {
          subject: 'বাংলা ও তথ্যপ্রযুক্তি',
          fullMarks: 100,
          obtainedMarks: 87,
          grade: 'মুমতায',
          remarks: 'উত্তীর্ণ',
        },
      ],
    },
  ];

  return { tuitionRecords, examRoutine, examResults };
}

async function getAuthenticatedStudent(req: Request): Promise<StoredStudentRecord | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  const studentId = verifyToken(token);
  if (!studentId) return null;

  if (isSqlConfigured()) {
    return findStudentByIdDb(studentId);
  }
  const db = readDatabase();
  return db.students.find((s) => s.id === studentId) ?? null;
}

function getNextStudentRoll(rolls: string[]): string {
  const maxSuffix = rolls.reduce((max, roll) => {
    const match = roll.match(/(\d+)$/);
    const num = match ? Number(match[1]) : 1000;
    return num > max ? num : max;
  }, 1000);
  return `STD-1448-${maxSuffix + 1}`;
}

export function createExpressApp() {
  ensureDataDir();

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'অনুরোধের তথ্য (JSON) সঠিক নয়।' });
      return;
    }
    next(err);
  });

  // 1. Register Student (saves in students + unified madrasa_records)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        name?: string;
        fatherName?: string;
        email?: string;
        phone?: string;
        password?: string;
        confirmPassword?: string;
      };

      const name = (body.name ?? '').trim();
      const fatherName = (body.fatherName ?? '').trim();
      const email = (body.email ?? '').trim().toLowerCase();
      const phone = normalizePhone(body.phone ?? '');
      const password = body.password ?? '';
      const confirmPassword = body.confirmPassword ?? '';

      if (name.length < 2) {
        res.status(400).json({ error: 'অনুগ্রহ করে শিক্ষার্থীর পূর্ণ নাম লিখুন।' });
        return;
      }
      if (fatherName && fatherName.length < 2) {
        res.status(400).json({ error: 'অনুগ্রহ করে পিতার পূর্ণ নাম লিখুন।' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'সঠিক ইমেইল ঠিকানা প্রদান করুন।' });
        return;
      }
      if (!/^01[3-9]\d{8}$/.test(phone)) {
        res.status(400).json({
          error: 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।',
        });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'পাসওয়ার্ড এবং নিশ্চিত পাসওয়ার্ড মিলছে না।' });
        return;
      }

      const { salt, hash } = hashPassword(password);
      const id = crypto.randomUUID();

      if (isSqlConfigured()) {
        const existing = await findStudentByPhoneOrEmailDb(phone, email);
        if (existing) {
          res.status(409).json({
            error:
              existing.phone === phone
                ? 'এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি একাউন্ট নিবন্ধিত রয়েছে।'
                : 'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট নিবন্ধিত রয়েছে।',
          });
          return;
        }
        const allStudents = await listStudentsDb();
        const studentRoll = getNextStudentRoll(allStudents.map((s) => s.studentRoll));
        const academicData = buildInitialAcademicData(studentRoll);

        const created = await insertStudentDb({
          id,
          studentRoll,
          name,
          fatherName,
          email,
          phone,
          department: 'কিতাব বিভাগ',
          className: 'মিযান / শরহে বেকায়া জামাত',
          session: '১৪৪৭–৪৮ হিজরি',
          passwordSalt: salt,
          passwordHash: hash,
          lastLoginAt: new Date(),
          ...academicData,
        });

        const token = signToken(created.id);
        res.status(201).json({ token, student: sanitizeStudent(created) });
        return;
      }

      const db = readDatabase();
      if (db.students.some((s) => s.phone === phone)) {
        res.status(409).json({
          error: 'এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি একাউন্ট নিবন্ধিত রয়েছে।',
        });
        return;
      }
      if (db.students.some((s) => s.email === email)) {
        res.status(409).json({
          error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট নিবন্ধিত রয়েছে।',
        });
        return;
      }

      const studentRoll = getNextStudentRoll(db.students.map((s) => s.studentRoll));
      const academicData = buildInitialAcademicData(studentRoll);

      const newRecord: StoredStudentRecord = {
        id,
        studentRoll,
        name,
        fatherName,
        email,
        phone,
        department: 'কিতাব বিভাগ',
        className: 'মিযান / শরহে বেকায়া জামাত',
        session: '১৪৪৭–৪৮ হিজরি',
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        ...academicData,
      };

      db.students.push(newRecord);
      writeDatabase(db);

      const token = signToken(newRecord.id);
      res.status(201).json({
        token,
        student: sanitizeStudent(newRecord),
      });
    } catch (error) {
      console.error('Error in POST /api/auth/register:', error);
      res.status(500).json({ error: 'নিবন্ধন সংরক্ষণ করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।' });
    }
  });

  // 2. Login Student with Phone & Password (updates last_login_at & unified madrasa_records)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const body = req.body as { phone?: string; password?: string };
      const phone = normalizePhone(body.phone ?? '');
      const password = body.password ?? '';

      if (!/^01[3-9]\d{8}$/.test(phone)) {
        res.status(400).json({ error: 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।' });
        return;
      }
      if (!password) {
        res.status(400).json({ error: 'অনুগ্রহ করে পাসওয়ার্ড লিখুন।' });
        return;
      }

      if (isSqlConfigured()) {
        const matched = await findStudentByPhoneDb(phone);
        if (!matched || !verifyPassword(password, matched.passwordSalt, matched.passwordHash)) {
          res.status(401).json({ error: 'মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' });
          return;
        }
        await recordStudentLoginDb(matched);
        const token = signToken(matched.id);
        res.json({
          token,
          student: sanitizeStudent(matched),
        });
        return;
      }

      const db = readDatabase();
      const matched = db.students.find((s) => s.phone === phone);
      if (!matched || !verifyPassword(password, matched.passwordSalt, matched.passwordHash)) {
        res.status(401).json({ error: 'মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' });
        return;
      }
      matched.lastLoginAt = new Date().toISOString();
      writeDatabase(db);

      const token = signToken(matched.id);
      res.json({
        token,
        student: sanitizeStudent(matched),
      });
    } catch (error) {
      console.error('Error in POST /api/auth/login:', error);
      res.status(500).json({ error: 'লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।' });
    }
  });

  // 2b. Firebase Google Sign-In Verification & Student Sync (protected by requireAuth)
  app.post('/api/auth/firebase', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const firebaseUser = req.user;
      if (!firebaseUser) {
        res.status(401).json({ error: 'অননুমোদিত প্রবেশ।' });
        return;
      }

      const body = req.body as { fatherName?: string; phone?: string } | undefined;
      const cleanName = (firebaseUser.name || firebaseUser.email?.split('@')[0] || 'Student').trim();
      const cleanEmail = (firebaseUser.email || '').trim().toLowerCase();
      const cleanFatherName = (body?.fatherName ?? '').trim();
      const cleanPhone = normalizePhone(body?.phone ?? '');

      if (isSqlConfigured()) {
        let student = await findStudentByFirebaseUidOrEmailDb(firebaseUser.uid, cleanEmail);
        if (student) {
          await recordStudentLoginDb(student, firebaseUser.uid);
        } else {
          const allStudents = await listStudentsDb();
          const studentRoll = getNextStudentRoll(allStudents.map((s) => s.studentRoll));
          const academicData = buildInitialAcademicData(studentRoll);
          student = await insertStudentDb({
            id: crypto.randomUUID(),
            studentRoll,
            firebaseUid: firebaseUser.uid,
            name: cleanName,
            fatherName: cleanFatherName,
            email: cleanEmail,
            phone: cleanPhone,
            department: 'কিতাব বিভাগ',
            className: 'মিযান / শরহে বেকায়া জামাত',
            session: '১৪৪৭–৪৮ হিজরি',
            passwordSalt: '',
            passwordHash: '',
            lastLoginAt: new Date(),
            ...academicData,
          });
        }
        const token = signToken(student.id);
        res.json({ token, student: sanitizeStudent(student) });
        return;
      }

      const db = readDatabase();
      let matched = db.students.find(
        (s) => s.firebaseUid === firebaseUser.uid || (cleanEmail && s.email === cleanEmail),
      );
      if (!matched) {
        const studentRoll = getNextStudentRoll(db.students.map((s) => s.studentRoll));
        const academicData = buildInitialAcademicData(studentRoll);
        matched = {
          id: crypto.randomUUID(),
          studentRoll,
          firebaseUid: firebaseUser.uid,
          name: cleanName,
          fatherName: cleanFatherName,
          email: cleanEmail,
          phone: cleanPhone,
          department: 'কিতাব বিভাগ',
          className: 'মিযান / শরহে বেকায়া জামাত',
          session: '১৪৪৭–৪৮ হিজরি',
          passwordSalt: '',
          passwordHash: '',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          ...academicData,
        };
        db.students.push(matched);
      } else {
        matched.firebaseUid = firebaseUser.uid;
        matched.lastLoginAt = new Date().toISOString();
      }
      writeDatabase(db);

      const token = signToken(matched.id);
      res.json({ token, student: sanitizeStudent(matched) });
    } catch (error) {
      console.error('Error in POST /api/auth/firebase:', error);
      res.status(500).json({ error: 'Google লগইন তথ্য সংরক্ষণ করা যায়নি।' });
    }
  });

  // 2c. Authenticated Firebase Users Endpoint (Cloud SQL users table)
  app.get('/api/users', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      if (!isSqlConfigured()) {
        res.json({ users: [] });
        return;
      }
      const userList = await getUsers();
      res.json({ users: userList });
    } catch (error) {
      console.error('Error in GET /api/users:', error);
      res.status(500).json({ error: 'Failed to retrieve user records.' });
    }
  });

  // 3. Get Current Student Session
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const student = await getAuthenticatedStudent(req);
      if (!student) {
        res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।' });
        return;
      }
      res.json({ student: sanitizeStudent(student) });
    } catch (error) {
      console.error('Error in GET /api/auth/me:', error);
      res.status(500).json({ error: 'সেশন যাচাই করা যায়নি।' });
    }
  });

  // 4. Get Full Student Dashboard Data
  app.get('/api/student/dashboard', async (req: Request, res: Response) => {
    try {
      const student = await getAuthenticatedStudent(req);
      if (!student) {
        res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।' });
        return;
      }

      const payload: StudentDashboardPayload = {
        student: sanitizeStudent(student),
        tuitionRecords: student.tuitionRecords,
        examRoutine: student.examRoutine,
        examResults: student.examResults,
      };

      res.json(payload);
    } catch (error) {
      console.error('Error in GET /api/student/dashboard:', error);
      res.status(500).json({ error: 'শিক্ষার্থীর ড্যাশবোর্ড লোড করা যায়নি।' });
    }
  });

  // 5. Mark Tuition Fee Paid (Interactive Persistent Action)
  app.post('/api/student/tuition/pay', async (req: Request, res: Response) => {
    try {
      const authed = await getAuthenticatedStudent(req);
      if (!authed) {
        res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।' });
        return;
      }

      const { recordId } = req.body as { recordId?: string };

      if (isSqlConfigured()) {
        const current = await findStudentByIdDb(authed.id);
        if (!current) {
          res.status(404).json({ error: 'শিক্ষার্থী পাওয়া যায়নি।' });
          return;
        }
        const tuitionCopy = current.tuitionRecords.map((r) => ({ ...r }));
        const record = tuitionCopy.find((r) => r.id === recordId);
        if (!record) {
          res.status(404).json({ error: 'বেতন খাত পাওয়া যায়নি।' });
          return;
        }
        if (record.status === 'বকেয়া') {
          let todayBn = '১৭ নভেম্বর ২০২৬';
          try {
            todayBn = new Intl.DateTimeFormat('bn-BD', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date());
          } catch {
            todayBn = '১৭ নভেম্বর ২০২৬';
          }
          record.status = 'পরিশোধিত';
          record.paidDate = todayBn;
          record.receiptNo = `RCP-2026-${Math.floor(10000 + Math.random() * 89999)}`;
          await updateStudentTuitionDb(current.id, tuitionCopy);
        }
        res.json({ tuitionRecords: tuitionCopy });
        return;
      }

      const db = readDatabase();
      const studentIndex = db.students.findIndex((s) => s.id === authed.id);
      if (studentIndex === -1) {
        res.status(404).json({ error: 'শিক্ষার্থী পাওয়া যায়নি।' });
        return;
      }

      const record = db.students[studentIndex].tuitionRecords.find((r) => r.id === recordId);
      if (!record) {
        res.status(404).json({ error: 'বেতন খাত পাওয়া যায়নি।' });
        return;
      }

      if (record.status === 'বকেয়া') {
        let todayBn = '১৭ নভেম্বর ২০২৬';
        try {
          todayBn = new Intl.DateTimeFormat('bn-BD', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date());
        } catch {
          todayBn = '১৭ নভেম্বর ২০২৬';
        }
        record.status = 'পরিশোধিত';
        record.paidDate = todayBn;
        record.receiptNo = `RCP-2026-${Math.floor(10000 + Math.random() * 89999)}`;
        writeDatabase(db);
      }

      res.json({ tuitionRecords: db.students[studentIndex].tuitionRecords });
    } catch (error) {
      console.error('Error in POST /api/student/tuition/pay:', error);
      res.status(500).json({ error: 'বেতন পরিশোধ সংরক্ষণ করা যায়নি।' });
    }
  });

  // ============================================================================
  // PUBLIC CMS & ONLINE ADMISSION ENDPOINTS
  // ============================================================================

  // 6. Get Full Public CMS Data (always fresh, no caching)
  app.get('/api/cms', async (_req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      const cms = await loadCmsDatabase();
      res.json({ cms });
    } catch (error) {
      console.error('Error in GET /api/cms:', error);
      res.status(500).json({ error: 'ওয়েবসাইটের তথ্য লোড করা যায়নি।' });
    }
  });

  // 6b. Real-Time Server-Sent Events (SSE) stream
  app.get('/api/cms/stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    try {
      const initialCms = await loadCmsDatabase();
      res.write(`event: cms-sync\ndata: ${JSON.stringify({ cms: initialCms })}\n\n`);
    } catch {
      res.write(`event: cms-sync\ndata: ${JSON.stringify({ cms: createDefaultCmsData() })}\n\n`);
    }

    cmsStreamClients.add(res);
    const keepalive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepalive);
        cmsStreamClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepalive);
      cmsStreamClients.delete(res);
    });
  });

  // 7. Submit & Persist Online Admission Form (writes to admissions + madrasa_records)
  app.post('/api/admissions', async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<StoredAdmissionRecord>;
      const studentName = (body.studentName ?? '').trim();
      const fatherName = (body.fatherName ?? '').trim();
      const dateOfBirth = (body.dateOfBirth ?? '').trim();
      const department = (body.department ?? '').trim();
      const departmentId = (body.departmentId ?? '').trim();
      const className = (body.className ?? '').trim();
      const classIndex = typeof body.classIndex === 'number' ? body.classIndex : 0;
      const residentialType = (body.residentialType ?? 'আবাসিক (বোর্ডিং)').trim();
      const residentialKey = body.residentialKey ?? 'boarding';
      const mobile = normalizePhone(body.mobile ?? '');
      const email = (body.email ?? '').trim().toLowerCase();
      const address = (body.address ?? '').trim();

      if (studentName.length < 2) {
        res.status(400).json({ error: 'অনুগ্রহ করে শিক্ষার্থীর পূর্ণ নাম লিখুন।' });
        return;
      }
      if (fatherName.length < 2) {
        res.status(400).json({ error: 'অনুগ্রহ করে পিতার পূর্ণ নাম লিখুন।' });
        return;
      }
      if (!department || !className) {
        res.status(400).json({ error: 'বিভাগ ও ক্লাস নির্বাচন করুন।' });
        return;
      }
      if (!/^01[3-9]\d{8}$/.test(mobile)) {
        res.status(400).json({ error: 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' });
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'সঠিক ইমেইল ঠিকানা প্রদান করুন।' });
        return;
      }
      if (address.length < 4) {
        res.status(400).json({ error: 'অনুগ্রহ করে বর্তমান ঠিকানা লিখুন।' });
        return;
      }

      if (isSqlConfigured()) {
        let trackingId = (body.trackingId ?? '').trim();
        if (!trackingId || (await findAdmissionByTrackingIdDb(trackingId))) {
          do {
            trackingId = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
          } while (await findAdmissionByTrackingIdDb(trackingId));
        }

        const record: StoredAdmissionRecord = {
          id: crypto.randomUUID(),
          trackingId,
          submittedAt: (body.submittedAt ?? new Date().toLocaleDateString('bn-BD')).trim(),
          submittedAtIso: new Date().toISOString(),
          studentName,
          fatherName,
          dateOfBirth,
          department,
          departmentId,
          className,
          classIndex,
          residentialType,
          residentialKey,
          mobile,
          email,
          address,
          status: 'pending',
          adminNote: '',
        };

        const saved = await insertAdmissionDb(record);
        res.status(201).json({ admission: saved });
        return;
      }

      const db = readAdmissionsDatabase();
      let trackingId = (body.trackingId ?? '').trim();
      if (!trackingId || db.admissions.some((a) => a.trackingId === trackingId)) {
        do {
          trackingId = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        } while (db.admissions.some((a) => a.trackingId === trackingId));
      }

      const record: StoredAdmissionRecord = {
        id: crypto.randomUUID(),
        trackingId,
        submittedAt: (body.submittedAt ?? new Date().toLocaleDateString('bn-BD')).trim(),
        submittedAtIso: new Date().toISOString(),
        studentName,
        fatherName,
        dateOfBirth,
        department,
        departmentId,
        className,
        classIndex,
        residentialType,
        residentialKey,
        mobile,
        email,
        address,
        status: 'pending',
        adminNote: '',
      };

      db.admissions.unshift(record);
      writeAdmissionsDatabase(db);
      res.status(201).json({ admission: record });
    } catch (error) {
      console.error('Error in POST /api/admissions:', error);
      res.status(500).json({ error: 'ভর্তি আবেদন সংরক্ষণ করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।' });
    }
  });

  // ============================================================================
  // ADMIN AUTH & BACKEND CMS DASHBOARD ENDPOINTS
  // ============================================================================

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const body = req.body as { username?: string; password?: string };
      const username = (body.username ?? '').trim().toLowerCase();
      const password = body.password ?? '';

      if (!username || !password) {
        res.status(400).json({ error: 'ইউজারনেম ও পাসওয়ার্ড লিখুন।' });
        return;
      }

      const adminStore = await loadOrInitAdminStore();
      if (
        username !== adminStore.username ||
        !verifyPassword(password, adminStore.passwordSalt, adminStore.passwordHash)
      ) {
        res.status(401).json({ error: 'অ্যাডমিন ইউজারনেম অথবা পাসওয়ার্ড সঠিক নয়।' });
        return;
      }

      const token = signToken(adminStore.username, 'admin');
      res.json({ token, admin: { username: adminStore.username } });
    } catch (error) {
      console.error('Error in POST /api/admin/login:', error);
      res.status(500).json({ error: 'অ্যাডমিন লগইন সম্পন্ন করা যায়নি।' });
    }
  });

  app.get('/api/admin/me', requireAdmin, (req: Request, res: Response) => {
    const username = verifyAdminRequest(req);
    res.json({ admin: { username } });
  });

  app.post('/api/admin/change-password', requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body as { currentPassword?: string; newPassword?: string };
      const currentPassword = body.currentPassword ?? '';
      const newPassword = body.newPassword ?? '';

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
        return;
      }

      const adminStore = await loadOrInitAdminStore();
      if (!verifyPassword(currentPassword, adminStore.passwordSalt, adminStore.passwordHash)) {
        res.status(401).json({ error: 'বর্তমান পাসওয়ার্ড সঠিক নয়।' });
        return;
      }

      const { salt, hash } = hashPassword(newPassword);
      await saveAdminStore({
        username: adminStore.username,
        passwordSalt: salt,
        passwordHash: hash,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Error in POST /api/admin/change-password:', error);
      res.status(500).json({ error: 'পাসওয়ার্ড পরিবর্তন সংরক্ষণ করা যায়নি।' });
    }
  });

  // Image Upload Endpoint (saves binary file into .data/uploads/)
  app.post('/api/admin/upload', requireAdmin, (req: Request, res: Response) => {
    const body = req.body as { filename?: string; dataUrl?: string };
    const dataUrl = body.dataUrl ?? '';
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,(.+)$/i);
    if (!match) {
      res.status(400).json({ error: 'সঠিক ছবি ফাইল (PNG, JPG, WEBP বা SVG) নির্বাচন করুন।' });
      return;
    }

    const mimeSubtype = match[1].toLowerCase();
    const ext =
      mimeSubtype === 'jpeg' || mimeSubtype === 'jpg'
        ? 'jpg'
        : mimeSubtype === 'svg+xml'
          ? 'svg'
          : mimeSubtype;
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
      res.status(400).json({ error: 'ছবির সাইজ ৮ মেগাবাইটের কম হতে হবে।' });
      return;
    }

    ensureDataDir();
    const safeName = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
    res.status(201).json({ url: `/uploads/${safeName}` });
  });

  app.get('/api/admin/cms', requireAdmin, async (_req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const cms = await loadCmsDatabase();
      res.json({ cms });
    } catch (error) {
      console.error('Error in GET /api/admin/cms:', error);
      res.status(500).json({ error: 'CMS তথ্য লোড করা যায়নি।' });
    }
  });

  app.put('/api/admin/site-settings', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const incoming = req.body as Partial<SiteSettingsCms>;
      cms.siteSettings = { ...cms.siteSettings, ...incoming };
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in PUT /api/admin/site-settings:', error);
      res.status(500).json({ error: 'সাইট সেটিংস সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put('/api/admin/hero', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const incoming = req.body as Partial<HeroSectionCms>;
      cms.heroSection = {
        ...cms.heroSection,
        ...incoming,
        slides: Array.isArray(incoming.slides) ? incoming.slides : cms.heroSection.slides,
        stats: Array.isArray(incoming.stats) ? incoming.stats : cms.heroSection.stats,
      };
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in PUT /api/admin/hero:', error);
      res.status(500).json({ error: 'হিরো সেকশন সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put('/api/admin/about', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const incoming = req.body as Partial<AboutSectionCms>;
      cms.aboutSection = {
        ...cms.aboutSection,
        ...incoming,
        coreValues: Array.isArray(incoming.coreValues)
          ? incoming.coreValues
          : cms.aboutSection.coreValues,
      };
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in PUT /api/admin/about:', error);
      res.status(500).json({ error: 'পরিচিতি সেকশন সংরক্ষণ করা যায়নি।' });
    }
  });

  // Departments CRUD
  app.post('/api/admin/departments', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const body = req.body as Partial<CmsDepartment>;
      if (!(body.nameBn ?? '').trim()) {
        res.status(400).json({ error: 'বিভাগের বাংলা নাম আবশ্যক।' });
        return;
      }
      const nextCodeNum = String(cms.departments.length + 1).padStart(2, '0');
      const dept: CmsDepartment = {
        id: (body.id ?? '').trim() || `dept-${Date.now()}`,
        codeBn: (body.codeBn ?? '').trim() || nextCodeNum,
        codeEn: (body.codeEn ?? '').trim() || nextCodeNum,
        nameBn: (body.nameBn ?? '').trim(),
        nameEn: (body.nameEn ?? '').trim() || (body.nameBn ?? '').trim(),
        subtitleBn: (body.subtitleBn ?? '').trim(),
        subtitleEn: (body.subtitleEn ?? '').trim() || (body.subtitleBn ?? '').trim(),
        durationBn: (body.durationBn ?? '').trim() || '১ বছর',
        durationEn: (body.durationEn ?? '').trim() || '1 Year',
        ageGroupBn: (body.ageGroupBn ?? '').trim() || 'সকল বয়স',
        ageGroupEn: (body.ageGroupEn ?? '').trim() || 'All Ages',
        descriptionBn: (body.descriptionBn ?? '').trim(),
        descriptionEn: (body.descriptionEn ?? '').trim() || (body.descriptionBn ?? '').trim(),
        highlightsBn: Array.isArray(body.highlightsBn) ? body.highlightsBn.filter(Boolean) : [],
        highlightsEn: Array.isArray(body.highlightsEn)
          ? body.highlightsEn.filter(Boolean)
          : Array.isArray(body.highlightsBn)
            ? body.highlightsBn.filter(Boolean)
            : [],
        classesBn:
          Array.isArray(body.classesBn) && body.classesBn.length > 0
            ? body.classesBn.filter(Boolean)
            : ['১ম বর্ষ'],
        classesEn:
          Array.isArray(body.classesEn) && body.classesEn.length > 0
            ? body.classesEn.filter(Boolean)
            : Array.isArray(body.classesBn) && body.classesBn.length > 0
              ? body.classesBn.filter(Boolean)
              : ['1st Year'],
      };
      cms.departments.push(dept);
      await saveCmsDatabase(cms);
      res.status(201).json({ cms, department: dept });
    } catch (error) {
      console.error('Error in POST /api/admin/departments:', error);
      res.status(500).json({ error: 'নতুন বিভাগ সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put('/api/admin/departments/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const idx = cms.departments.findIndex((d) => d.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'বিভাগটি পাওয়া যায়নি।' });
        return;
      }
      const body = req.body as Partial<CmsDepartment>;
      cms.departments[idx] = { ...cms.departments[idx], ...body, id: cms.departments[idx].id };
      await saveCmsDatabase(cms);
      res.json({ cms, department: cms.departments[idx] });
    } catch (error) {
      console.error('Error in PUT /api/admin/departments/:id:', error);
      res.status(500).json({ error: 'বিভাগের তথ্য হালনাগাদ করা যায়নি।' });
    }
  });

  app.delete('/api/admin/departments/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      if (cms.departments.length <= 1) {
        res.status(400).json({ error: 'কমপক্ষে একটি শিক্ষা বিভাগ থাকতে হবে।' });
        return;
      }
      cms.departments = cms.departments.filter((d) => d.id !== req.params.id);
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in DELETE /api/admin/departments/:id:', error);
      res.status(500).json({ error: 'বিভাগ মুছে ফেলা যায়নি।' });
    }
  });

  // Notices CRUD + Archive
  app.post('/api/admin/notices', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const body = req.body as Partial<CmsNotice>;
      if (!(body.titleBn ?? '').trim()) {
        res.status(400).json({ error: 'নোটিশের শিরোনাম আবশ্যক।' });
        return;
      }
      const todayBn = new Date().toLocaleDateString('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const todayEn = new Date().toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const notice: CmsNotice = {
        id: `notice-${Date.now()}`,
        status: body.status === 'archived' ? 'archived' : 'active',
        category: body.category ?? 'সাধারণ',
        dateBn: (body.dateBn ?? '').trim() || todayBn,
        dateEn: (body.dateEn ?? '').trim() || todayEn,
        hijriDateBn: (body.hijriDateBn ?? '').trim() || 'জমাদিউস সানি ১৪৪৮ হি.',
        hijriDateEn: (body.hijriDateEn ?? '').trim() || 'Jumada al-Thani 1448 AH',
        refNumber:
          (body.refNumber ?? '').trim() || `স্মারক: দা.সা./২০২৬-${cms.notices.length + 105}`,
        titleBn: (body.titleBn ?? '').trim(),
        titleEn: (body.titleEn ?? '').trim() || (body.titleBn ?? '').trim(),
        summaryBn: (body.summaryBn ?? '').trim(),
        summaryEn: (body.summaryEn ?? '').trim() || (body.summaryBn ?? '').trim(),
        fullTextBn: Array.isArray(body.fullTextBn) ? body.fullTextBn.filter(Boolean) : [],
        fullTextEn:
          Array.isArray(body.fullTextEn) && body.fullTextEn.length > 0
            ? body.fullTextEn.filter(Boolean)
            : Array.isArray(body.fullTextBn)
              ? body.fullTextBn.filter(Boolean)
              : [],
        issuedByBn:
          (body.issuedByBn ?? '').trim() ||
          'মুহতামিম, দারুস সালাম নুরানী ও মহিলা হাফিজিয়া মাদ্রাসা',
        issuedByEn:
          (body.issuedByEn ?? '').trim() ||
          'Muhtamim, Darus Salam Nurani & Mohila Hafizia Madrasa',
        createdAt: new Date().toISOString(),
      };
      cms.notices.unshift(notice);
      await saveCmsDatabase(cms);
      res.status(201).json({ cms, notice });
    } catch (error) {
      console.error('Error in POST /api/admin/notices:', error);
      res.status(500).json({ error: 'নোটিশ সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put('/api/admin/notices/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const idx = cms.notices.findIndex((n) => n.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'নোটিশটি পাওয়া যায়নি।' });
        return;
      }
      const body = req.body as Partial<CmsNotice>;
      cms.notices[idx] = { ...cms.notices[idx], ...body, id: cms.notices[idx].id };
      await saveCmsDatabase(cms);
      res.json({ cms, notice: cms.notices[idx] });
    } catch (error) {
      console.error('Error in PUT /api/admin/notices/:id:', error);
      res.status(500).json({ error: 'নোটিশ হালনাগাদ করা যায়নি।' });
    }
  });

  app.patch('/api/admin/notices/:id/status', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const idx = cms.notices.findIndex((n) => n.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'নোটিশটি পাওয়া যায়নি।' });
        return;
      }
      const { status } = req.body as { status?: NoticeStatus };
      if (status !== 'active' && status !== 'archived') {
        res.status(400).json({ error: 'অবস্থা (status) সঠিক নয়।' });
        return;
      }
      cms.notices[idx].status = status;
      cms.notices[idx].archivedAt = status === 'archived' ? new Date().toISOString() : undefined;
      await saveCmsDatabase(cms);
      res.json({ cms, notice: cms.notices[idx] });
    } catch (error) {
      console.error('Error in PATCH /api/admin/notices/:id/status:', error);
      res.status(500).json({ error: 'নোটিশের অবস্থা পরিবর্তন করা যায়নি।' });
    }
  });

  app.delete('/api/admin/notices/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      cms.notices = cms.notices.filter((n) => n.id !== req.params.id);
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in DELETE /api/admin/notices/:id:', error);
      res.status(500).json({ error: 'নোটিশ মুছে ফেলা যায়নি।' });
    }
  });

  // Gallery CRUD
  app.post('/api/admin/gallery', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const body = req.body as Partial<CmsGalleryItem>;
      if (!(body.titleBn ?? '').trim() || !(body.imageUrl ?? '').trim()) {
        res.status(400).json({ error: 'ছবির শিরোনাম ও ছবি আবশ্যক।' });
        return;
      }
      const item: CmsGalleryItem = {
        id: `gal-${Date.now()}`,
        titleBn: (body.titleBn ?? '').trim(),
        titleEn: (body.titleEn ?? '').trim() || (body.titleBn ?? '').trim(),
        category: body.category ?? 'ক্যাম্পাস',
        dateBn: (body.dateBn ?? '').trim() || 'নভেম্বর ২০২৬',
        dateEn: (body.dateEn ?? '').trim() || 'November 2026',
        imageUrl: (body.imageUrl ?? '').trim(),
      };
      cms.gallery.unshift(item);
      await saveCmsDatabase(cms);
      res.status(201).json({ cms, item });
    } catch (error) {
      console.error('Error in POST /api/admin/gallery:', error);
      res.status(500).json({ error: 'গ্যালারির ছবি সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put('/api/admin/gallery/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const idx = cms.gallery.findIndex((g) => g.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'ছবিটি পাওয়া যায়নি।' });
        return;
      }
      const body = req.body as Partial<CmsGalleryItem>;
      cms.gallery[idx] = { ...cms.gallery[idx], ...body, id: cms.gallery[idx].id };
      await saveCmsDatabase(cms);
      res.json({ cms, item: cms.gallery[idx] });
    } catch (error) {
      console.error('Error in PUT /api/admin/gallery/:id:', error);
      res.status(500).json({ error: 'ছবি হালনাগাদ করা যায়নি।' });
    }
  });

  app.delete('/api/admin/gallery/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      cms.gallery = cms.gallery.filter((g) => g.id !== req.params.id);
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in DELETE /api/admin/gallery/:id:', error);
      res.status(500).json({ error: 'ছবি মুছে ফেলা যায়নি।' });
    }
  });

  // Teachers CRUD
  app.post('/api/admin/teachers', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const body = req.body as Partial<CmsTeacherProfile>;
      if (!(body.nameBn ?? '').trim() || !(body.designationBn ?? '').trim()) {
        res.status(400).json({ error: 'শিক্ষকের নাম ও পদবি আবশ্যক।' });
        return;
      }
      const teacher: CmsTeacherProfile = {
        id: `teacher-${Date.now()}`,
        nameBn: (body.nameBn ?? '').trim(),
        nameEn: (body.nameEn ?? '').trim() || (body.nameBn ?? '').trim(),
        designationBn: (body.designationBn ?? '').trim(),
        designationEn: (body.designationEn ?? '').trim() || (body.designationBn ?? '').trim(),
        departmentBn: (body.departmentBn ?? '').trim() || 'সাধারণ ও দ্বীনি বিভাগ',
        departmentEn:
          (body.departmentEn ?? '').trim() ||
          (body.departmentBn ?? '').trim() ||
          'Academic Department',
        qualificationBn: (body.qualificationBn ?? '').trim(),
        qualificationEn: (body.qualificationEn ?? '').trim() || (body.qualificationBn ?? '').trim(),
        experienceBn: (body.experienceBn ?? '').trim(),
        experienceEn: (body.experienceEn ?? '').trim() || (body.experienceBn ?? '').trim(),
        subjectsBn: Array.isArray(body.subjectsBn) ? body.subjectsBn.filter(Boolean) : [],
        subjectsEn:
          Array.isArray(body.subjectsEn) && body.subjectsEn.length > 0
            ? body.subjectsEn.filter(Boolean)
            : Array.isArray(body.subjectsBn)
              ? body.subjectsBn.filter(Boolean)
              : [],
        bioBn: (body.bioBn ?? '').trim(),
        bioEn: (body.bioEn ?? '').trim() || (body.bioBn ?? '').trim(),
        photoUrl: (body.photoUrl ?? '').trim(),
      };
      cms.teachers.push(teacher);
      await saveCmsDatabase(cms);
      res.status(201).json({ cms, teacher });
    } catch (error) {
      console.error('Error in POST /api/admin/teachers:', error);
      res.status(500).json({ error: 'শিক্ষকের প্রোফাইল সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put('/api/admin/teachers/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      const idx = cms.teachers.findIndex((t) => t.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'শিক্ষকের তথ্য পাওয়া যায়নি।' });
        return;
      }
      const body = req.body as Partial<CmsTeacherProfile>;
      cms.teachers[idx] = { ...cms.teachers[idx], ...body, id: cms.teachers[idx].id };
      await saveCmsDatabase(cms);
      res.json({ cms, teacher: cms.teachers[idx] });
    } catch (error) {
      console.error('Error in PUT /api/admin/teachers/:id:', error);
      res.status(500).json({ error: 'শিক্ষকের তথ্য হালনাগাদ করা যায়নি।' });
    }
  });

  app.delete('/api/admin/teachers/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const cms = await loadCmsDatabase();
      cms.teachers = cms.teachers.filter((t) => t.id !== req.params.id);
      await saveCmsDatabase(cms);
      res.json({ cms });
    } catch (error) {
      console.error('Error in DELETE /api/admin/teachers/:id:', error);
      res.status(500).json({ error: 'শিক্ষকের তথ্য মুছে ফেলা যায়নি।' });
    }
  });

  // Online Admissions Admin View & Management
  app.get('/api/admin/admissions', requireAdmin, async (_req: Request, res: Response) => {
    try {
      if (isSqlConfigured()) {
        const list = await listAdmissionsDb();
        res.json({ admissions: list });
        return;
      }
      const db = readAdmissionsDatabase();
      res.json({ admissions: db.admissions });
    } catch (error) {
      console.error('Error in GET /api/admin/admissions:', error);
      res.status(500).json({ error: 'ভর্তি আবেদনসমূহ লোড করা যায়নি।' });
    }
  });

  app.patch('/api/admin/admissions/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body as { status?: AdmissionStatus; adminNote?: string };
      const validStatus =
        body.status && ['pending', 'interview', 'approved', 'rejected'].includes(body.status)
          ? body.status
          : undefined;
      const cleanNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : undefined;

      if (isSqlConfigured()) {
        const updated = await updateAdmissionDb(req.params.id, {
          status: validStatus,
          adminNote: cleanNote,
        });
        if (!updated) {
          res.status(404).json({ error: 'আবেদনটি পাওয়া যায়নি।' });
          return;
        }
        const list = await listAdmissionsDb();
        res.json({ admission: updated, admissions: list });
        return;
      }

      const db = readAdmissionsDatabase();
      const idx = db.admissions.findIndex((a) => a.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'আবেদনটি পাওয়া যায়নি।' });
        return;
      }
      if (validStatus) {
        db.admissions[idx].status = validStatus;
      }
      if (cleanNote !== undefined) {
        db.admissions[idx].adminNote = cleanNote;
      }
      writeAdmissionsDatabase(db);
      res.json({ admission: db.admissions[idx], admissions: db.admissions });
    } catch (error) {
      console.error('Error in PATCH /api/admin/admissions/:id:', error);
      res.status(500).json({ error: 'আবেদনের অবস্থা হালনাগাদ করা যায়নি।' });
    }
  });

  app.delete('/api/admin/admissions/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      if (isSqlConfigured()) {
        await deleteAdmissionDb(req.params.id);
        const list = await listAdmissionsDb();
        res.json({ admissions: list });
        return;
      }

      const db = readAdmissionsDatabase();
      db.admissions = db.admissions.filter((a) => a.id !== req.params.id);
      writeAdmissionsDatabase(db);
      res.json({ admissions: db.admissions });
    } catch (error) {
      console.error('Error in DELETE /api/admin/admissions/:id:', error);
      res.status(500).json({ error: 'ভর্তি আবেদন মুছে ফেলা যায়নি।' });
    }
  });

  // Unified Single-Table Records (Online Forms + Student Logins/Registrations in Separate Columns)
  const buildFallbackUnifiedRecords = (): UnifiedMadrasaRecord[] => {
    const admDb = readAdmissionsDatabase();
    const stuDb = readDatabase();
    let seq = 1;
    const admRows: UnifiedMadrasaRecord[] = admDb.admissions.map((a) => ({
      id: seq++,
      recordType: 'online_admission',
      referenceCode: a.trackingId,
      name: a.studentName,
      fatherName: a.fatherName,
      mobile: a.mobile,
      email: a.email ?? '',
      passwordHash: '',
      dateOfBirth: a.dateOfBirth,
      department: a.department,
      className: a.className,
      residentialType: a.residentialType,
      address: a.address,
      status: a.status,
      firebaseUid: '',
      lastLoginAt: null,
      createdAt: a.submittedAtIso,
      updatedAt: a.submittedAtIso,
    }));
    const stuRows: UnifiedMadrasaRecord[] = stuDb.students.map((s) => ({
      id: seq++,
      recordType: s.firebaseUid ? 'google_signin' : 'student_account',
      referenceCode: s.studentRoll,
      name: s.name,
      fatherName: s.fatherName ?? '',
      mobile: s.phone,
      email: s.email,
      passwordHash: s.passwordHash ? `${s.passwordSalt}:${s.passwordHash}` : '',
      dateOfBirth: '',
      department: s.department,
      className: s.className,
      residentialType: '',
      address: '',
      status: 'active',
      firebaseUid: s.firebaseUid ?? '',
      lastLoginAt: s.lastLoginAt ?? null,
      createdAt: s.createdAt,
      updatedAt: s.lastLoginAt ?? s.createdAt,
    }));
    return [...admRows, ...stuRows];
  };

  app.get('/api/admin/records', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const records = isSqlConfigured()
        ? await listUnifiedMadrasaRecords()
        : buildFallbackUnifiedRecords();
      res.json({ records });
    } catch (error) {
      console.error('Error in GET /api/admin/records:', error);
      res.status(500).json({ error: 'সকল সংরক্ষিত তথ্য লোড করা যায়নি।' });
    }
  });

  app.get('/api/admin/records.csv', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const records = isSqlConfigured()
        ? await listUnifiedMadrasaRecords()
        : buildFallbackUnifiedRecords();

      const headers = [
        'ID',
        'Record Type',
        'Reference Code',
        'Name',
        'Father Name',
        'Mobile',
        'Email',
        'Password Hash',
        'Date of Birth',
        'Department',
        'Class / Jamat',
        'Residential Type',
        'Address',
        'Status',
        'Last Login At',
        'Created At',
      ];
      const escapeCell = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const csvRows = records.map((r) =>
        [
          r.id,
          r.recordType,
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
        ]
          .map(escapeCell)
          .join(','),
      );

      const csv = '\uFEFF' + [headers.map(escapeCell).join(','), ...csvRows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="madrasa-all-records-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (error) {
      console.error('Error in GET /api/admin/records.csv:', error);
      res.status(500).json({ error: 'CSV ফাইল তৈরি করা যায়নি।' });
    }
  });

  app.post('/api/admin/reset-defaults', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const fresh = createDefaultCmsData();
      await saveCmsDatabase(fresh);
      res.json({ cms: fresh });
    } catch (error) {
      console.error('Error in POST /api/admin/reset-defaults:', error);
      res.status(500).json({ error: 'ডিফল্ট তথ্য পুনঃস্থাপন করা যায়নি।' });
    }
  });

  app.get('/api/admin/ui-config', requireAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ config: await loadAdminUiConfig() });
    } catch (error) {
      console.error('Error in GET /api/admin/ui-config:', error);
      res.status(500).json({ error: 'ড্যাশবোর্ড কনফিগারেশন লোড করা যায়নি।' });
    }
  });

  app.put('/api/admin/ui-config', requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'সঠিক ড্যাশবোর্ড কনফিগারেশন পাঠান।' });
        return;
      }
      await saveAdminUiConfig(body);
      res.json({ config: body });
    } catch (error) {
      console.error('Error in PUT /api/admin/ui-config:', error);
      res.status(500).json({ error: 'ড্যাশবোর্ড কনফিগারেশন সংরক্ষণ করা যায়নি।' });
    }
  });

  app.post('/api/admin/ui-config/reset', requireAdmin, async (_req: Request, res: Response) => {
    try {
      await resetAdminUiConfig();
      res.json({ config: null });
    } catch (error) {
      console.error('Error in POST /api/admin/ui-config/reset:', error);
      res.status(500).json({ error: 'ড্যাশবোর্ড কনফিগারেশন রিসেট করা যায়নি।' });
    }
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'অনুরোধকৃত API পাওয়া যায়নি।' });
  });

  return app;
}

async function startServer() {
  const app = createExpressApp();

  // Vite middleware in development / static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
