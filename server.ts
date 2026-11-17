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

interface StoredStudentRecord {
  id: string;
  studentRoll: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  className: string;
  session: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
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
const SECRET_FILE = path.join(DATA_DIR, '.session_secret');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signToken(studentId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: studentId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token: string): string | null {
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
      exp?: number;
    };
    if (!decoded.sub || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return decoded.sub;
  } catch {
    return null;
  }
}

function sanitizeStudent(record: StoredStudentRecord): StudentUser {
  return {
    id: record.id,
    studentRoll: record.studentRoll,
    name: record.name,
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

function getAuthenticatedStudent(req: Request): StoredStudentRecord | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  const studentId = verifyToken(token);
  if (!studentId) return null;

  const db = readDatabase();
  return db.students.find((s) => s.id === studentId) ?? null;
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'অনুরোধের তথ্য (JSON) সঠিক নয়।' });
      return;
    }
    next(err);
  });

  // 1. Register Student
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string;
    };

    const name = (body.name ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const phone = normalizePhone(body.phone ?? '');
    const password = body.password ?? '';
    const confirmPassword = body.confirmPassword ?? '';

    if (name.length < 2) {
      res.status(400).json({ error: 'অনুগ্রহ করে শিক্ষার্থীর পূর্ণ নাম লিখুন।' });
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

    const { salt, hash } = hashPassword(password);
    const id = crypto.randomUUID();
    const maxSuffix = db.students.reduce((max, s) => {
      const match = s.studentRoll.match(/(\d+)$/);
      const num = match ? Number(match[1]) : 1000;
      return num > max ? num : max;
    }, 1000);
    const studentRoll = `STD-1448-${maxSuffix + 1}`;
    const academicData = buildInitialAcademicData(studentRoll);

    const newRecord: StoredStudentRecord = {
      id,
      studentRoll,
      name,
      email,
      phone,
      department: 'কিতাব বিভাগ',
      className: 'মিযান / শরহে বেকায়া জামাত',
      session: '১৪৪৭–৪৮ হিজরি',
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      ...academicData,
    };

    db.students.push(newRecord);
    writeDatabase(db);

    const token = signToken(newRecord.id);
    res.status(201).json({
      token,
      student: sanitizeStudent(newRecord),
    });
  });

  // 2. Login Student with Phone & Password
  app.post('/api/auth/login', (req: Request, res: Response) => {
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

    const db = readDatabase();
    const matched = db.students.find((s) => s.phone === phone);
    if (!matched || !verifyPassword(password, matched.passwordSalt, matched.passwordHash)) {
      res.status(401).json({ error: 'মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' });
      return;
    }

    const token = signToken(matched.id);
    res.json({
      token,
      student: sanitizeStudent(matched),
    });
  });

  // 3. Get Current Student Session
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const student = getAuthenticatedStudent(req);
    if (!student) {
      res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।' });
      return;
    }
    res.json({ student: sanitizeStudent(student) });
  });

  // 4. Get Full Student Dashboard Data
  app.get('/api/student/dashboard', (req: Request, res: Response) => {
    const student = getAuthenticatedStudent(req);
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
  });

  // 5. Mark Tuition Fee Paid (Interactive Persistent Action)
  app.post('/api/student/tuition/pay', (req: Request, res: Response) => {
    const authed = getAuthenticatedStudent(req);
    if (!authed) {
      res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।' });
      return;
    }

    const { recordId } = req.body as { recordId?: string };
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
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'অনুরোধকৃত API পাওয়া যায়নি।' });
  });

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

startServer();
