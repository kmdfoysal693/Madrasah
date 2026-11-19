export interface StudentUser {
  id: string;
  studentRoll: string;
  name: string;
  fatherName?: string;
  email: string;
  phone: string;
  department: string;
  className: string;
  session: string;
}

export interface TuitionRecord {
  id: string;
  month: string;
  feeType: string;
  amount: number;
  status: 'পরিশোধিত' | 'বকেয়া';
  paidDate: string;
  receiptNo: string;
}

export interface ExamRoutineItem {
  id: string;
  date: string;
  day: string;
  time: string;
  subject: string;
  kitabCode: string;
  hallAndSeat: string;
}

export interface ExamResultSubject {
  subject: string;
  fullMarks: number;
  obtainedMarks: number;
  grade: string;
  remarks: string;
}

export interface ExamResultTerm {
  id: string;
  termName: string;
  publishedDate: string;
  meritPosition: string;
  overallGrade: string;
  subjects: ExamResultSubject[];
}

export interface StudentDashboardPayload {
  student: StudentUser;
  tuitionRecords: TuitionRecord[];
  examRoutine: ExamRoutineItem[];
  examResults: ExamResultTerm[];
}
