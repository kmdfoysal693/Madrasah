import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { normalizeMobileNumber, type AdmissionSubmission } from '../data/madrasaData';
import type { StudentUser } from '../data/studentPortalData';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string, fallbackPrefix: string, maxLen = 40): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  if (cleaned.length >= 4) return cleaned;
  return `${fallbackPrefix}-${Date.now()}`.slice(0, maxLen);
}

function clampString(val: string | undefined | null, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const uid = sanitizeId(user.uid, 'user', 128);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        email: clampString(user.email, 160),
        displayName: clampString(user.displayName, 120),
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email: clampString(user.email, 160),
        displayName: clampString(user.displayName, 120),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAdmissionToFirestore(
  submission: AdmissionSubmission,
): Promise<string | null> {
  const trackingId = sanitizeId(submission.trackingId, 'ADM-2026', 40);
  const mobile = normalizeMobileNumber(submission.mobile).slice(0, 15);
  if (!/^01[3-9][0-9]{8}$/.test(mobile)) {
    return null;
  }

  const studentName = clampString(submission.studentName, 120);
  const fatherName = clampString(submission.fatherName, 120);
  const address = clampString(submission.address, 400);
  if (studentName.length < 2 || fatherName.length < 2 || address.length < 4) {
    return null;
  }

  const ownerUid =
    auth.currentUser && auth.currentUser.emailVerified ? clampString(auth.currentUser.uid, 128) : '';
  const residentialKey =
    submission.residentialKey === 'day_care' || submission.residentialKey === 'non_residential'
      ? submission.residentialKey
      : 'boarding';

  const path = `admissions/${trackingId}`;
  try {
    await setDoc(doc(db, 'admissions', trackingId), {
      trackingId,
      ownerUid,
      studentName,
      fatherName,
      dateOfBirth: clampString(submission.dateOfBirth, 32),
      department: clampString(submission.department, 120) || 'কিতাব বিভাগ',
      departmentId: clampString(submission.departmentId, 64),
      className: clampString(submission.className, 120) || 'সাধারণ',
      classIndex:
        typeof submission.classIndex === 'number' &&
        Number.isInteger(submission.classIndex) &&
        submission.classIndex >= 0 &&
        submission.classIndex <= 50
          ? submission.classIndex
          : 0,
      residentialType: clampString(submission.residentialType, 80) || 'আবাসিক (বোর্ডিং)',
      residentialKey,
      mobile,
      email: clampString(submission.email, 160).toLowerCase(),
      address,
      status: 'pending',
      submittedAt: clampString(submission.submittedAt, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return trackingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveStudentToFirestore(
  student: StudentUser,
  accountType: 'student_account' | 'google_signin',
): Promise<string | null> {
  const docId = sanitizeId(student.id || student.studentRoll, 'stu', 128);
  const studentRoll = sanitizeId(student.studentRoll, 'STD-1448', 40);
  const name = clampString(student.name, 120);
  if (name.length < 2) return null;

  const ownerUid =
    auth.currentUser && auth.currentUser.emailVerified ? clampString(auth.currentUser.uid, 128) : '';
  const path = `students/${docId}`;
  const ref = doc(db, 'students', docId);

  try {
    const existingSnap = ownerUid ? await getDoc(ref) : null;
    if (existingSnap && existingSnap.exists()) {
      await updateDoc(ref, {
        name,
        fatherName: clampString(student.fatherName, 120),
        phone: clampString(normalizeMobileNumber(student.phone), 15),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        studentRoll,
        ownerUid,
        accountType,
        name,
        fatherName: clampString(student.fatherName, 120),
        phone: clampString(normalizeMobileNumber(student.phone), 15),
        email: clampString(student.email, 160).toLowerCase(),
        department: clampString(student.department, 120) || 'কিতাব বিভাগ',
        className: clampString(student.className, 120) || 'মিযান / শরহে বেকায়া জামাত',
        session: clampString(student.session, 64) || '১৪৪৭–৪৮ হিজরি',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
