import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type {
  ExamResultTerm,
  ExamRoutineItem,
  TuitionRecord,
} from '../data/studentPortalData.ts';

// 1. Firebase Authenticated Users Table (linked via Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Unified Madrasa Records Table (stores every online form applicant & logged-in/registered student in separate columns)
export const madrasaRecords = pgTable('madrasa_records', {
  id: serial('id').primaryKey(),
  recordType: text('record_type').notNull(), // 'online_admission' | 'student_account' | 'admission_and_student' | 'google_signin'
  referenceCode: text('reference_code').notNull().unique(),
  name: text('name').notNull(),
  fatherName: text('father_name').default('').notNull(),
  mobile: text('mobile').default('').notNull(),
  email: text('email').default('').notNull(),
  passwordHash: text('password_hash').default('').notNull(),
  dateOfBirth: text('date_of_birth').default('').notNull(),
  department: text('department').default('').notNull(),
  className: text('class_name').default('').notNull(),
  residentialType: text('residential_type').default('').notNull(),
  address: text('address').default('').notNull(),
  status: text('status').default('active').notNull(),
  firebaseUid: text('firebase_uid').default('').notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Online Admission Applications Table
export const admissions = pgTable('admissions', {
  id: text('id').primaryKey(),
  trackingId: text('tracking_id').notNull().unique(),
  submittedAt: text('submitted_at').notNull(),
  submittedAtIso: text('submitted_at_iso').notNull(),
  studentName: text('student_name').notNull(),
  fatherName: text('father_name').notNull(),
  dateOfBirth: text('date_of_birth').default('').notNull(),
  department: text('department').notNull(),
  departmentId: text('department_id').default('').notNull(),
  className: text('class_name').notNull(),
  classIndex: integer('class_index').default(0).notNull(),
  residentialType: text('residential_type').notNull(),
  residentialKey: text('residential_key').default('boarding').notNull(),
  mobile: text('mobile').notNull(),
  email: text('email').default('').notNull(),
  address: text('address').notNull(),
  status: text('status').default('pending').notNull(),
  adminNote: text('admin_note').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Student Portal Accounts & Academic Records Table
export const students = pgTable('students', {
  id: text('id').primaryKey(),
  studentRoll: text('student_roll').notNull().unique(),
  firebaseUid: text('firebase_uid').default('').notNull(),
  name: text('name').notNull(),
  fatherName: text('father_name').default('').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  department: text('department').notNull(),
  className: text('class_name').notNull(),
  session: text('session').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  tuitionRecords: jsonb('tuition_records').$type<TuitionRecord[]>().notNull(),
  examRoutine: jsonb('exam_routine').$type<ExamRoutineItem[]>().notNull(),
  examResults: jsonb('exam_results').$type<ExamResultTerm[]>().notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Persistent CMS, Admin Config & Key-Value State Table
export const cmsState = pgTable('cms_state', {
  key: text('key').primaryKey(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
