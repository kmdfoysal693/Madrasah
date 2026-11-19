import { desc, eq, or } from 'drizzle-orm';
import { db } from './index.ts';
import { admissions, cmsState, madrasaRecords, students } from './schema.ts';
import type { AdmissionStatus, StoredAdmissionRecord } from '../data/cmsTypes.ts';
import type {
  ExamResultTerm,
  ExamRoutineItem,
  TuitionRecord,
} from '../data/studentPortalData.ts';

export interface DbStudentRecord {
  id: string;
  studentRoll: string;
  firebaseUid: string;
  name: string;
  fatherName: string;
  email: string;
  phone: string;
  department: string;
  className: string;
  session: string;
  passwordSalt: string;
  passwordHash: string;
  tuitionRecords: TuitionRecord[];
  examRoutine: ExamRoutineItem[];
  examResults: ExamResultTerm[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UnifiedMadrasaRecord {
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

function mapRowToAdmission(row: typeof admissions.$inferSelect): StoredAdmissionRecord {
  return {
    id: row.id,
    trackingId: row.trackingId,
    submittedAt: row.submittedAt,
    submittedAtIso: row.submittedAtIso,
    studentName: row.studentName,
    fatherName: row.fatherName,
    dateOfBirth: row.dateOfBirth,
    department: row.department,
    departmentId: row.departmentId,
    className: row.className,
    classIndex: row.classIndex,
    residentialType: row.residentialType as StoredAdmissionRecord['residentialType'],
    residentialKey: row.residentialKey as StoredAdmissionRecord['residentialKey'],
    mobile: row.mobile,
    email: row.email ?? '',
    address: row.address,
    status: row.status as AdmissionStatus,
    adminNote: row.adminNote,
  };
}

function mapRowToStudent(row: typeof students.$inferSelect): DbStudentRecord {
  return {
    id: row.id,
    studentRoll: row.studentRoll,
    firebaseUid: row.firebaseUid,
    name: row.name,
    fatherName: row.fatherName,
    email: row.email,
    phone: row.phone,
    department: row.department,
    className: row.className,
    session: row.session,
    passwordSalt: row.passwordSalt,
    passwordHash: row.passwordHash,
    tuitionRecords: row.tuitionRecords,
    examRoutine: row.examRoutine,
    examResults: row.examResults,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRowToUnifiedRecord(row: typeof madrasaRecords.$inferSelect): UnifiedMadrasaRecord {
  return {
    id: row.id,
    recordType: row.recordType,
    referenceCode: row.referenceCode,
    name: row.name,
    fatherName: row.fatherName,
    mobile: row.mobile,
    email: row.email,
    passwordHash: row.passwordHash,
    dateOfBirth: row.dateOfBirth,
    department: row.department,
    className: row.className,
    residentialType: row.residentialType,
    address: row.address,
    status: row.status,
    firebaseUid: row.firebaseUid,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------- Unified Single-Table Recorder ----------
export async function upsertUnifiedMadrasaRecord(input: {
  recordType: 'online_admission' | 'student_account' | 'admission_and_student' | 'google_signin';
  referenceCode: string;
  name: string;
  fatherName?: string;
  mobile?: string;
  email?: string;
  passwordHash?: string;
  dateOfBirth?: string;
  department?: string;
  className?: string;
  residentialType?: string;
  address?: string;
  status?: string;
  firebaseUid?: string;
  lastLoginAt?: Date | null;
}): Promise<UnifiedMadrasaRecord> {
  try {
    const now = new Date();
    const result = await db
      .insert(madrasaRecords)
      .values({
        recordType: input.recordType,
        referenceCode: input.referenceCode,
        name: input.name,
        fatherName: input.fatherName ?? '',
        mobile: input.mobile ?? '',
        email: input.email ?? '',
        passwordHash: input.passwordHash ?? '',
        dateOfBirth: input.dateOfBirth ?? '',
        department: input.department ?? '',
        className: input.className ?? '',
        residentialType: input.residentialType ?? '',
        address: input.address ?? '',
        status: input.status ?? 'active',
        firebaseUid: input.firebaseUid ?? '',
        lastLoginAt: input.lastLoginAt ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: madrasaRecords.referenceCode,
        set: {
          recordType: input.recordType,
          name: input.name,
          fatherName: input.fatherName ?? '',
          mobile: input.mobile ?? '',
          email: input.email ?? '',
          ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
          ...(input.dateOfBirth ? { dateOfBirth: input.dateOfBirth } : {}),
          ...(input.department ? { department: input.department } : {}),
          ...(input.className ? { className: input.className } : {}),
          ...(input.residentialType ? { residentialType: input.residentialType } : {}),
          ...(input.address ? { address: input.address } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.firebaseUid ? { firebaseUid: input.firebaseUid } : {}),
          ...(input.lastLoginAt ? { lastLoginAt: input.lastLoginAt } : {}),
          updatedAt: now,
        },
      })
      .returning();

    return mapRowToUnifiedRecord(result[0]);
  } catch (error) {
    console.error('Database query failed in upsertUnifiedMadrasaRecord:', error);
    throw new Error('Failed to save record in PostgreSQL.', { cause: error });
  }
}

export async function listUnifiedMadrasaRecords(): Promise<UnifiedMadrasaRecord[]> {
  try {
    const rows = await db
      .select()
      .from(madrasaRecords)
      .orderBy(desc(madrasaRecords.createdAt));
    return rows.map(mapRowToUnifiedRecord);
  } catch (error) {
    console.error('Database query failed in listUnifiedMadrasaRecords:', error);
    throw new Error('Failed to load records from PostgreSQL.', { cause: error });
  }
}

// ---------- Admissions ----------
export async function listAdmissionsDb(): Promise<StoredAdmissionRecord[]> {
  try {
    const rows = await db.select().from(admissions).orderBy(desc(admissions.createdAt));
    return rows.map(mapRowToAdmission);
  } catch (error) {
    console.error('Database query failed in listAdmissionsDb:', error);
    throw new Error('Failed to fetch admissions from PostgreSQL.', { cause: error });
  }
}

export async function findAdmissionByTrackingIdDb(
  trackingId: string,
): Promise<StoredAdmissionRecord | null> {
  try {
    const rows = await db
      .select()
      .from(admissions)
      .where(eq(admissions.trackingId, trackingId))
      .limit(1);
    return rows[0] ? mapRowToAdmission(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findAdmissionByTrackingIdDb:', error);
    throw new Error('Failed to verify tracking ID.', { cause: error });
  }
}

export async function insertAdmissionDb(
  record: StoredAdmissionRecord & { email?: string },
): Promise<StoredAdmissionRecord> {
  try {
    const inserted = await db
      .insert(admissions)
      .values({
        id: record.id,
        trackingId: record.trackingId,
        submittedAt: record.submittedAt,
        submittedAtIso: record.submittedAtIso,
        studentName: record.studentName,
        fatherName: record.fatherName,
        dateOfBirth: record.dateOfBirth ?? '',
        department: record.department,
        departmentId: record.departmentId ?? '',
        className: record.className,
        classIndex: record.classIndex ?? 0,
        residentialType: record.residentialType,
        residentialKey: record.residentialKey ?? 'boarding',
        mobile: record.mobile,
        email: record.email ?? '',
        address: record.address,
        status: record.status,
        adminNote: record.adminNote,
      })
      .returning();

    await upsertUnifiedMadrasaRecord({
      recordType: 'online_admission',
      referenceCode: record.trackingId,
      name: record.studentName,
      fatherName: record.fatherName,
      mobile: record.mobile,
      email: record.email ?? '',
      dateOfBirth: record.dateOfBirth ?? '',
      department: record.department,
      className: record.className,
      residentialType: record.residentialType,
      address: record.address,
      status: record.status,
    });

    return mapRowToAdmission(inserted[0]);
  } catch (error) {
    console.error('Database query failed in insertAdmissionDb:', error);
    throw new Error('Failed to save online admission to PostgreSQL.', { cause: error });
  }
}

export async function updateAdmissionDb(
  id: string,
  patch: { status?: AdmissionStatus; adminNote?: string },
): Promise<StoredAdmissionRecord | null> {
  try {
    const existing = await db.select().from(admissions).where(eq(admissions.id, id)).limit(1);
    if (!existing[0]) return null;

    const updated = await db
      .update(admissions)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(typeof patch.adminNote === 'string' ? { adminNote: patch.adminNote } : {}),
      })
      .where(eq(admissions.id, id))
      .returning();

    if (patch.status) {
      await db
        .update(madrasaRecords)
        .set({ status: patch.status, updatedAt: new Date() })
        .where(eq(madrasaRecords.referenceCode, existing[0].trackingId));
    }

    return updated[0] ? mapRowToAdmission(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed in updateAdmissionDb:', error);
    throw new Error('Failed to update admission record in PostgreSQL.', { cause: error });
  }
}

export async function deleteAdmissionDb(id: string): Promise<boolean> {
  try {
    const existing = await db.select().from(admissions).where(eq(admissions.id, id)).limit(1);
    if (!existing[0]) return false;
    await db.delete(admissions).where(eq(admissions.id, id));
    return true;
  } catch (error) {
    console.error('Database query failed in deleteAdmissionDb:', error);
    throw new Error('Failed to delete admission record from PostgreSQL.', { cause: error });
  }
}

// ---------- Students ----------
export async function listStudentsDb(): Promise<DbStudentRecord[]> {
  try {
    const rows = await db.select().from(students).orderBy(desc(students.createdAt));
    return rows.map(mapRowToStudent);
  } catch (error) {
    console.error('Database query failed in listStudentsDb:', error);
    throw new Error('Failed to fetch student accounts.', { cause: error });
  }
}

export async function findStudentByIdDb(id: string): Promise<DbStudentRecord | null> {
  try {
    const rows = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return rows[0] ? mapRowToStudent(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findStudentByIdDb:', error);
    throw new Error('Failed to load student profile.', { cause: error });
  }
}

export async function findStudentByPhoneOrEmailDb(
  phone: string,
  email: string,
): Promise<DbStudentRecord | null> {
  try {
    const rows = await db
      .select()
      .from(students)
      .where(or(eq(students.phone, phone), eq(students.email, email)))
      .limit(1);
    return rows[0] ? mapRowToStudent(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findStudentByPhoneOrEmailDb:', error);
    throw new Error('Failed to look up student account.', { cause: error });
  }
}

export async function findStudentByPhoneDb(phone: string): Promise<DbStudentRecord | null> {
  try {
    const rows = await db.select().from(students).where(eq(students.phone, phone)).limit(1);
    return rows[0] ? mapRowToStudent(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findStudentByPhoneDb:', error);
    throw new Error('Failed to look up student by mobile.', { cause: error });
  }
}

export async function findStudentByFirebaseUidOrEmailDb(
  uid: string,
  email: string,
): Promise<DbStudentRecord | null> {
  try {
    const rows = await db
      .select()
      .from(students)
      .where(
        email
          ? or(eq(students.firebaseUid, uid), eq(students.email, email.toLowerCase()))
          : eq(students.firebaseUid, uid),
      )
      .limit(1);
    return rows[0] ? mapRowToStudent(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findStudentByFirebaseUidOrEmailDb:', error);
    throw new Error('Failed to look up Google student profile.', { cause: error });
  }
}

export async function insertStudentDb(record: {
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
  tuitionRecords: TuitionRecord[];
  examRoutine: ExamRoutineItem[];
  examResults: ExamResultTerm[];
  lastLoginAt?: Date | null;
}): Promise<DbStudentRecord> {
  try {
    const inserted = await db
      .insert(students)
      .values({
        id: record.id,
        studentRoll: record.studentRoll,
        firebaseUid: record.firebaseUid ?? '',
        name: record.name,
        fatherName: record.fatherName ?? '',
        email: record.email,
        phone: record.phone,
        department: record.department,
        className: record.className,
        session: record.session,
        passwordSalt: record.passwordSalt,
        passwordHash: record.passwordHash,
        tuitionRecords: record.tuitionRecords,
        examRoutine: record.examRoutine,
        examResults: record.examResults,
        lastLoginAt: record.lastLoginAt ?? new Date(),
      })
      .returning();

    await upsertUnifiedMadrasaRecord({
      recordType: record.firebaseUid ? 'google_signin' : 'student_account',
      referenceCode: record.studentRoll,
      name: record.name,
      fatherName: record.fatherName ?? '',
      mobile: record.phone,
      email: record.email,
      passwordHash: record.passwordHash ? `${record.passwordSalt}:${record.passwordHash}` : '',
      department: record.department,
      className: record.className,
      firebaseUid: record.firebaseUid ?? '',
      status: 'active',
      lastLoginAt: record.lastLoginAt ?? new Date(),
    });

    return mapRowToStudent(inserted[0]);
  } catch (error) {
    console.error('Database query failed in insertStudentDb:', error);
    throw new Error('Failed to create student account in PostgreSQL.', { cause: error });
  }
}

export async function recordStudentLoginDb(student: DbStudentRecord, firebaseUid?: string) {
  try {
    const now = new Date();
    await db
      .update(students)
      .set({
        lastLoginAt: now,
        ...(firebaseUid ? { firebaseUid } : {}),
      })
      .where(eq(students.id, student.id));

    await upsertUnifiedMadrasaRecord({
      recordType: firebaseUid ? 'google_signin' : 'student_account',
      referenceCode: student.studentRoll,
      name: student.name,
      fatherName: student.fatherName,
      mobile: student.phone,
      email: student.email,
      passwordHash: student.passwordHash ? `${student.passwordSalt}:${student.passwordHash}` : '',
      department: student.department,
      className: student.className,
      firebaseUid: firebaseUid ?? student.firebaseUid,
      status: 'active',
      lastLoginAt: now,
    });
  } catch (error) {
    console.error('Database query failed in recordStudentLoginDb:', error);
    throw new Error('Failed to record student login.', { cause: error });
  }
}

export async function updateStudentTuitionDb(
  studentId: string,
  tuitionRecords: TuitionRecord[],
): Promise<void> {
  try {
    await db.update(students).set({ tuitionRecords }).where(eq(students.id, studentId));
  } catch (error) {
    console.error('Database query failed in updateStudentTuitionDb:', error);
    throw new Error('Failed to update student tuition records.', { cause: error });
  }
}

// ---------- CMS & Admin State ----------
export async function getCmsStateValueDb<T>(key: string): Promise<T | null> {
  try {
    const rows = await db.select().from(cmsState).where(eq(cmsState.key, key)).limit(1);
    return rows[0] ? (rows[0].payload as unknown as T) : null;
  } catch (error) {
    console.error(`Database query failed in getCmsStateValueDb(${key}):`, error);
    throw new Error('Failed to read application state from PostgreSQL.', { cause: error });
  }
}

export async function setCmsStateValueDb(
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const now = new Date();
    await db
      .insert(cmsState)
      .values({
        key,
        payload,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: cmsState.key,
        set: {
          payload,
          updatedAt: now,
        },
      });
  } catch (error) {
    console.error(`Database query failed in setCmsStateValueDb(${key}):`, error);
    throw new Error('Failed to persist application state in PostgreSQL.', { cause: error });
  }
}

export async function deleteCmsStateValueDb(key: string): Promise<void> {
  try {
    await db.delete(cmsState).where(eq(cmsState.key, key));
  } catch (error) {
    console.error(`Database query failed in deleteCmsStateValueDb(${key}):`, error);
    throw new Error('Failed to remove state key from PostgreSQL.', { cause: error });
  }
}
