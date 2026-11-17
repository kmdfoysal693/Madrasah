import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Printer,
} from 'lucide-react';
import { NOTICES, MAX_NOTICES, toBengaliDigits, type NoticeCategory, type NoticeItem } from '../data/madrasaData';
import type { StudentDashboardPayload, TuitionRecord } from '../data/studentPortalData';
import { NoticeModal } from './NoticeModal';

interface StudentDashboardProps {
  token: string;
  onBackToSite: () => void;
  onLogout: () => void;
}

type DashboardSection = 'overview' | 'notices' | 'tuition' | 'routine' | 'results';

const NAV_ITEMS: { id: DashboardSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'সারসংক্ষেপ', icon: LayoutDashboard },
  { id: 'notices', label: 'নোটিশ বোর্ড', icon: Bell },
  { id: 'tuition', label: 'মাসিক বেতনের হিসাব', icon: CreditCard },
  { id: 'routine', label: 'পরীক্ষার রুটিন', icon: CalendarDays },
  { id: 'results', label: 'পরীক্ষার রেজাল্ট', icon: Award },
];

export function StudentDashboard({
  token,
  onBackToSite,
  onLogout,
}: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardSection>('overview');
  const [payload, setPayload] = useState<StudentDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [noticeFilter, setNoticeFilter] = useState<'সকল' | NoticeCategory>('সকল');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    if (!selectedNotice) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedNotice]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDashboard() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/student/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          onLogoutRef.current();
          return;
        }
        const data = (await res.json()) as StudentDashboardPayload & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? 'তথ্য লোড করা যায়নি।');
        }
        if (!cancelled) {
          setPayload(data);
          if (data.examResults.length > 0) {
            setSelectedTermId(data.examResults[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'ড্যাশবোর্ড লোড করতে সমস্যা হয়েছে।');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tuitionStats = useMemo(() => {
    const records = payload?.tuitionRecords ?? [];
    const totalPaid = records
      .filter((r) => r.status === 'পরিশোধিত')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalDue = records
      .filter((r) => r.status === 'বকেয়া')
      .reduce((sum, r) => sum + r.amount, 0);
    const paidMonths = records.filter((r) => r.status === 'পরিশোধিত').length;
    const dueMonths = records.filter((r) => r.status === 'বকেয়া').length;
    return { totalPaid, totalDue, paidMonths, dueMonths };
  }, [payload]);

  const filteredNotices = useMemo(() => {
    const list =
      noticeFilter === 'সকল'
        ? NOTICES
        : NOTICES.filter((n) => n.category === noticeFilter);
    return list.slice(0, MAX_NOTICES);
  }, [noticeFilter]);

  const activeResultTerm = useMemo(() => {
    if (!payload?.examResults.length) return null;
    return (
      payload.examResults.find((t) => t.id === selectedTermId) ?? payload.examResults[0]
    );
  }, [payload, selectedTermId]);

  const termTotals = useMemo(() => {
    if (!activeResultTerm) return { totalFull: 0, totalObtained: 0, percentage: '০' };
    const totalFull = activeResultTerm.subjects.reduce((s, item) => s + item.fullMarks, 0);
    const totalObtained = activeResultTerm.subjects.reduce(
      (s, item) => s + item.obtainedMarks,
      0,
    );
    const pct = totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 0;
    return { totalFull, totalObtained, percentage: toBengaliDigits(pct) };
  }, [activeResultTerm]);

  const handlePayTuition = async (record: TuitionRecord) => {
    if (record.status === 'পরিশোধিত') return;
    setPayingId(record.id);
    setPayError('');
    try {
      const res = await fetch('/api/student/tuition/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recordId: record.id }),
      });
      if (res.status === 401) {
        onLogoutRef.current();
        return;
      }
      const data = (await res.json()) as { tuitionRecords?: TuitionRecord[]; error?: string };
      if (!res.ok || !data.tuitionRecords) {
        setPayError(data.error ?? 'বেতন পরিশোধ সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
        return;
      }
      setPayload((prev) =>
        prev ? { ...prev, tuitionRecords: data.tuitionRecords! } : prev,
      );
    } catch {
      setPayError('সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <header className="border-b border-[#E2E8F0] bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" />
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-28 animate-pulse rounded-xl border border-[#E2E8F0] bg-white"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <div className="max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
          <h2 className="mt-4 font-serif text-xl font-bold text-[#0F172A]">
            ড্যাশবোর্ড লোড করা যায়নি
          </h2>
          <p className="mt-2 text-sm text-[#475569]">{error}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackToSite}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              মূল পেজে ফিরুন
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-[#065F46] px-4 py-2 text-sm font-medium text-white hover:bg-[#047857]"
            >
              পুনরায় লগইন করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { student } = payload;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Portal Header */}
      <header className="no-print sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <GraduationCap className="h-6 w-6 shrink-0 text-[#065F46]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-serif text-sm font-bold text-[#0F172A] sm:text-base">
                আল-জামিয়াতুল ইসলামিয়া · ছাত্র ড্যাশবোর্ড
              </p>
              <p className="truncate text-xs text-[#475569] tabular-nums">
                {student.name} · আইডি: {student.studentRoll}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] whitespace-nowrap shrink-0 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>মূল ওয়েবসাইট</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#047857] whitespace-nowrap shrink-0 sm:text-sm"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar Navigation (Desktop) / Mobile Segmented Rail */}
          <aside className="no-print lg:col-span-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <div className="border-b border-[#E2E8F0] pb-4">
                <p className="text-xs font-medium text-[#B45309]">{student.session}</p>
                <h1 className="mt-1 font-serif text-lg font-bold text-[#0F172A]">
                  {student.name}
                </h1>
                <p className="mt-0.5 text-xs text-[#475569]">{student.className}</p>
                <p className="mt-1 text-xs font-medium text-[#065F46] tabular-nums">
                  মোবাইল: {toBengaliDigits(student.phone)}
                </p>
              </div>

              <nav aria-label="ড্যাশবোর্ড মেনু" className="mt-4 flex flex-wrap gap-1.5 lg:flex-col">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#065F46] text-white'
                          : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Dashboard Content */}
          <main className="lg:col-span-9">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 4 KPI Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">মোট পরিশোধিত বেতন</p>
                    <p className="mt-2 font-serif text-2xl font-bold text-[#065F46] tabular-nums">
                      ৳ {toBengaliDigits(tuitionStats.totalPaid)}
                    </p>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      {toBengaliDigits(tuitionStats.paidMonths)} মাসের বেতন পরিশোধিত
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">বর্তমান বকেয়া বেতন</p>
                    <p className="mt-2 font-serif text-2xl font-bold text-[#B45309] tabular-nums">
                      ৳ {toBengaliDigits(tuitionStats.totalDue)}
                    </p>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      {toBengaliDigits(tuitionStats.dueMonths)} মাস বকেয়া রয়েছে
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">আসন্ন পরীক্ষা</p>
                    <p className="mt-2 font-serif text-xl font-bold text-[#0F172A] tabular-nums">
                      ২৫ নভেম্বর ২০২৬
                    </p>
                    <p className="mt-1 text-xs text-[#475569]">২য় সাময়িক পরীক্ষা</p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">সর্বশেষ ফলাফল</p>
                    <p className="mt-2 font-serif text-xl font-bold text-[#065F46]">
                      {activeResultTerm?.overallGrade ?? 'মুমতায'}
                    </p>
                    <p className="mt-1 text-xs text-[#475569]">
                      {activeResultTerm?.meritPosition}
                    </p>
                  </div>
                </div>

                {/* Quick Preview: Recent Notices + Next Exam */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                      <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                        সাম্প্রতিক নোটিশ
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('notices')}
                        className="text-xs font-semibold text-[#065F46] hover:underline"
                      >
                        সব দেখুন
                      </button>
                    </div>
                    <div className="mt-4 divide-y divide-[#E2E8F0]">
                      {NOTICES.slice(0, 3).map((notice) => (
                        <div key={notice.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-xs text-[#475569] tabular-nums">
                            <span className="font-semibold text-[#065F46]">{notice.category}</span> ·{' '}
                            {notice.date}
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedNotice(notice)}
                            className="mt-1 text-left text-sm font-medium text-[#0F172A] hover:text-[#065F46]"
                          >
                            {notice.title}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                      <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                        আসন্ন পরীক্ষার সময়সূচি
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('routine')}
                        className="text-xs font-semibold text-[#065F46] hover:underline"
                      >
                        পূর্ণ রুটিন
                      </button>
                    </div>
                    <div className="mt-4 divide-y divide-[#E2E8F0]">
                      {payload.examRoutine.slice(0, 3).map((exam) => (
                        <div key={exam.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-xs text-[#B45309] tabular-nums">
                            {exam.date} · {exam.time}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#0F172A]">{exam.subject}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notices' && (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      শিক্ষার্থীদের নোটিশ বোর্ড
                    </h2>
                    <p className="mt-1 text-xs text-[#475569]">
                      মাদ্রাসার সর্বশেষ বিজ্ঞপ্তি ও নির্দেশনাবলি
                    </p>
                  </div>

                  <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                    {(['সকল', 'ভর্তি', 'পরীক্ষা', 'সাধারণ'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNoticeFilter(cat)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          noticeFilter === cat
                            ? 'bg-[#065F46] text-white'
                            : 'text-[#475569] hover:text-[#0F172A]'
                        }`}
                      >
                        {cat === 'সকল' ? 'সকল নোটিশ' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 divide-y divide-[#E2E8F0]">
                  {filteredNotices.map((notice) => (
                    <div
                      key={notice.id}
                      className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-xs text-[#475569] tabular-nums">
                          <span className="font-semibold text-[#065F46]">{notice.category}</span> ·{' '}
                          {notice.date} · {notice.refNumber}
                        </p>
                        <h3 className="mt-1 font-serif text-base font-semibold text-[#0F172A]">
                          {notice.title}
                        </h3>
                        <p className="mt-1 text-sm text-[#475569]">{notice.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedNotice(notice)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#065F46] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>বিস্তারিত দেখুন</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tuition' && (
              <div className="printable-area rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      মাসিক বেতন ও ফি হিসাব বিবরণী
                    </h2>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      শিক্ষার্থী: {student.name} · আইডি: {student.studentRoll}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                  >
                    <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span>হিসাব প্রিন্ট করুন</span>
                  </button>
                </div>

                {payError && (
                  <div
                    role="alert"
                    className="no-print mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                  >
                    {payError}
                  </div>
                )}

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <span className="text-xs text-[#475569]">মোট পরিশোধিত:</span>
                    <span className="ml-2 font-serif text-base font-bold text-[#065F46] tabular-nums">
                      ৳ {toBengaliDigits(tuitionStats.totalPaid)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <span className="text-xs text-[#475569]">মোট বকেয়া:</span>
                    <span className="ml-2 font-serif text-base font-bold text-[#B45309] tabular-nums">
                      ৳ {toBengaliDigits(tuitionStats.totalDue)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                        <th className="py-3 pr-4">মাস</th>
                        <th className="py-3 pr-4">খাতের বিবরণ</th>
                        <th className="py-3 pr-4 text-right">পরিমাণ</th>
                        <th className="py-3 pr-4">জমার তারিখ</th>
                        <th className="py-3 pr-4">রশিদ নং</th>
                        <th className="py-3 pr-4">অবস্থা</th>
                        <th className="no-print py-3 text-right">কার্যক্রম</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {payload.tuitionRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-3.5 pr-4 font-medium text-[#0F172A] whitespace-nowrap">
                            {record.month}
                          </td>
                          <td className="py-3.5 pr-4 text-[#475569]">{record.feeType}</td>
                          <td className="py-3.5 pr-4 text-right font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                            ৳ {toBengaliDigits(record.amount)}
                          </td>
                          <td className="py-3.5 pr-4 text-[#475569] tabular-nums whitespace-nowrap">
                            {record.paidDate}
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-[#475569] tabular-nums whitespace-nowrap">
                            {record.receiptNo}
                          </td>
                          <td className="py-3.5 pr-4 whitespace-nowrap">
                            {record.status === 'পরিশোধিত' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#065F46]">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>পরিশোধিত</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
                                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>বকেয়া</span>
                              </span>
                            )}
                          </td>
                          <td className="no-print py-3.5 text-right whitespace-nowrap">
                            {record.status === 'বকেয়া' ? (
                              <button
                                type="button"
                                disabled={payingId === record.id}
                                onClick={() => handlePayTuition(record)}
                                className="rounded-md bg-[#065F46] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#047857] disabled:opacity-60"
                              >
                                {payingId === record.id ? 'প্রক্রিয়াধীন...' : 'পরিশোধ করুন'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">সম্পন্ন</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'routine' && (
              <div className="printable-area rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      ২য় সাময়িক পরীক্ষার সময়সূচি (রুটিন)
                    </h2>
                    <p className="mt-1 text-xs text-[#475569]">
                      জামাত: {student.className} · শিক্ষাবর্ষ {student.session}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                  >
                    <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span>রুটিন প্রিন্ট করুন</span>
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                        <th className="py-3 pr-4">তারিখ ও বার</th>
                        <th className="py-3 pr-4">সময়</th>
                        <th className="py-3 pr-4">বিষয় / কিতাব</th>
                        <th className="py-3 pr-4">কোড</th>
                        <th className="py-3">কক্ষ ও আসন নং</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {payload.examRoutine.map((exam) => (
                        <tr key={exam.id} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-3.5 pr-4 whitespace-nowrap">
                            <p className="font-medium text-[#0F172A] tabular-nums">{exam.date}</p>
                            <p className="text-xs text-[#475569]">{exam.day}</p>
                          </td>
                          <td className="py-3.5 pr-4 text-[#475569] tabular-nums whitespace-nowrap">
                            {exam.time}
                          </td>
                          <td className="py-3.5 pr-4 font-semibold text-[#0F172A]">
                            {exam.subject}
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-[#065F46] whitespace-nowrap">
                            {exam.kitabCode}
                          </td>
                          <td className="py-3.5 text-[#475569] whitespace-nowrap">
                            {exam.hallAndSeat}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'results' && activeResultTerm && (
              <div className="printable-area rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      পরীক্ষার ফলাফল ও নম্বরপত্র
                    </h2>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      শিক্ষার্থী: {student.name} · রোল: {student.studentRoll}
                    </p>
                  </div>

                  <div className="no-print flex flex-wrap items-center gap-2">
                    <select
                      aria-label="পরীক্ষার টার্ম নির্বাচন করুন"
                      value={activeResultTerm.id}
                      onChange={(e) => setSelectedTermId(e.target.value)}
                      className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                    >
                      {payload.examResults.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.termName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
                    >
                      <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                      <span>প্রিন্ট</span>
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">মোট প্রাপ্ত নম্বর</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#065F46] tabular-nums">
                      {toBengaliDigits(termTotals.totalObtained)} /{' '}
                      {toBengaliDigits(termTotals.totalFull)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">শতকরা হার</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#0F172A] tabular-nums">
                      {termTotals.percentage}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">সামগ্রিক বিভাগ</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#065F46]">
                      {activeResultTerm.overallGrade}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">মেধাস্থান</p>
                    <p className="mt-1 font-serif text-base font-bold text-[#B45309]">
                      {activeResultTerm.meritPosition}
                    </p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                        <th className="py-3 pr-4">বিষয় / কিতাব</th>
                        <th className="py-3 pr-4 text-right">পূর্ণমান</th>
                        <th className="py-3 pr-4 text-right">প্রাপ্ত নম্বর</th>
                        <th className="py-3 pr-4">গ্রেড / বিভাগ</th>
                        <th className="py-3">মন্তব্য</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {activeResultTerm.subjects.map((subj) => (
                        <tr key={subj.subject} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-3.5 pr-4 font-medium text-[#0F172A]">
                            {subj.subject}
                          </td>
                          <td className="py-3.5 pr-4 text-right text-[#475569] tabular-nums">
                            {toBengaliDigits(subj.fullMarks)}
                          </td>
                          <td className="py-3.5 pr-4 text-right font-semibold text-[#0F172A] tabular-nums">
                            {toBengaliDigits(subj.obtainedMarks)}
                          </td>
                          <td className="py-3.5 pr-4 font-semibold text-[#065F46]">
                            {subj.grade}
                          </td>
                          <td className="py-3.5 text-[#475569]">{subj.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-[#475569]">
                  ফলাফল প্রকাশের তারিখ: {activeResultTerm.publishedDate}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      <NoticeModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
    </div>
  );
}
