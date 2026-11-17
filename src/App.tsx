import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  GraduationCap,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Phone,
  User,
  X,
} from 'lucide-react';
import {
  ADMISSION_STEPS,
  CORE_VALUES,
  DEPARTMENTS,
  INITIAL_GALLERY_ITEMS,
  MAX_GALLERY_PHOTOS,
  MAX_NOTICES,
  NOTICES,
  RESIDENTIAL_TYPES,
  STATS,
  TEACHERS,
  generateTrackingId,
  getFormattedDates,
  isValidBdMobile,
  normalizeMobileNumber,
  toBengaliDigits,
  type AdmissionSubmission,
  type NoticeCategory,
  type NoticeItem,
  type ResidentialType,
  type TeacherProfile,
} from './data/madrasaData';
import type { StudentUser } from './data/studentPortalData';
import { NoticeModal } from './components/NoticeModal';
import { ReceiptModal } from './components/ReceiptModal';
import { GalleryLightboxModal } from './components/GalleryModals';
import { TeacherProfileModal } from './components/TeacherProfileModal';
import { StudentAuthModal } from './components/StudentAuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdmissionFormModal } from './components/AdmissionFormModal';

const NAV_LINKS = [
  { href: '#home', label: 'হোম' },
  { href: '#about', label: 'পরিচিতি' },
  { href: '#departments', label: 'বিভাগসমূহ' },
  { href: '#notices', label: 'নোটিশ' },
  { href: '#gallery', label: 'গ্যালারি' },
  { href: '#teachers', label: 'শিক্ষকমণ্ডলী' },
  { href: '#admission', label: 'ভর্তি' },
  { href: '#contact', label: 'যোগাযোগ' },
];

type NoticeFilter = 'সকল' | NoticeCategory;

const NOTICE_FILTERS: { id: NoticeFilter; label: string }[] = [
  { id: 'সকল', label: 'সকল নোটিশ' },
  { id: 'ভর্তি', label: 'ভর্তি' },
  { id: 'পরীক্ষা', label: 'পরীক্ষা' },
  { id: 'সাধারণ', label: 'সাধারণ' },
];

interface FormErrors {
  studentName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  department?: string;
  mobile?: string;
  address?: string;
}

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState<NoticeFilter>('সকল');
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [libraryImgFailed, setLibraryImgFailed] = useState(false);
  const [muhtamimImgFailed, setMuhtamimImgFailed] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [failedGalleryIds, setFailedGalleryIds] = useState<Record<string, boolean>>({});
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [failedTeacherIds, setFailedTeacherIds] = useState<Record<string, boolean>>({});
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [studentToken, setStudentToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('madrasa_student_token');
    } catch {
      return null;
    }
  });
  const [currentStudent, setCurrentStudent] = useState<StudentUser | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const skipNextMeFetchRef = useRef(false);

  useEffect(() => {
    if (!studentToken) {
      setCurrentStudent(null);
      return;
    }
    if (skipNextMeFetchRef.current) {
      skipNextMeFetchRef.current = false;
      return;
    }
    let cancelled = false;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Unauthorized'))))
      .then((data: { student?: StudentUser }) => {
        if (!cancelled && data.student) {
          setCurrentStudent(data.student);
        }
      })
      .catch(() => {
        if (!cancelled) {
          try {
            localStorage.removeItem('madrasa_student_token');
          } catch {
            // ignore storage errors
          }
          setStudentToken(null);
          setCurrentStudent(null);
          setShowDashboard(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [studentToken]);

  const handleStudentAuthSuccess = (token: string, student: StudentUser) => {
    try {
      localStorage.setItem('madrasa_student_token', token);
    } catch {
      // ignore storage errors
    }
    skipNextMeFetchRef.current = true;
    setStudentToken(token);
    setCurrentStudent(student);
    setAuthModalOpen(false);
    setShowDashboard(true);
  };

  const handleStudentLogout = useCallback(() => {
    try {
      localStorage.removeItem('madrasa_student_token');
    } catch {
      // ignore storage errors
    }
    setStudentToken(null);
    setCurrentStudent(null);
    setShowDashboard(false);
  }, []);

  // Online Admission Form & Modal State
  const [admissionModalOpen, setAdmissionModalOpen] = useState(false);
  const [admissionInitialDept, setAdmissionInitialDept] = useState<string>(DEPARTMENTS[0].name);
  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0].name);
  const [className, setClassName] = useState(DEPARTMENTS[0].classes[0]);
  const [residentialType, setResidentialType] = useState<ResidentialType>('আবাসিক (বোর্ডিং)');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [latestSubmission, setLatestSubmission] = useState<AdmissionSubmission | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const inlineAvailableClasses = useMemo(() => {
    const matched = DEPARTMENTS.find((d) => d.name === department);
    return matched ? matched.classes : DEPARTMENTS[0].classes;
  }, [department]);

  const openAdmissionPopup = (deptName?: string) => {
    setAdmissionInitialDept(deptName ?? DEPARTMENTS[0].name);
    setAdmissionModalOpen(true);
  };

  const isAnyModalOpen =
    Boolean(selectedNotice) ||
    receiptModalOpen ||
    lightboxIndex !== null ||
    Boolean(selectedTeacher) ||
    authModalOpen ||
    admissionModalOpen;

  useEffect(() => {
    if (!isAnyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isAnyModalOpen]);

  const { weekday, gregorian, hijri } = useMemo(() => getFormattedDates(), []);

  const filteredNotices = useMemo(() => {
    const list =
      noticeFilter === 'সকল'
        ? NOTICES
        : NOTICES.filter((item) => item.category === noticeFilter);
    return list.slice(0, MAX_NOTICES);
  }, [noticeFilter]);

  const galleryItems = useMemo(
    () => INITIAL_GALLERY_ITEMS.slice(0, MAX_GALLERY_PHOTOS),
    [],
  );

  const visibleTeachers = useMemo(
    () => (showAllTeachers ? TEACHERS : TEACHERS.slice(0, 3)),
    [showAllTeachers],
  );

  const handleSelectDepartmentAndScroll = (deptName: string) => {
    openAdmissionPopup(deptName);
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!studentName.trim() || studentName.trim().length < 2) {
      nextErrors.studentName = 'অনুগ্রহ করে শিক্ষার্থীর পূর্ণ নাম লিখুন।';
    }
    if (!fatherName.trim() || fatherName.trim().length < 2) {
      nextErrors.fatherName = 'অনুগ্রহ করে পিতার পূর্ণ নাম লিখুন।';
    }
    if (!dateOfBirth) {
      nextErrors.dateOfBirth = 'শিক্ষার্থীর জন্ম তারিখ নির্বাচন করুন।';
    }
    if (!department) {
      nextErrors.department = 'অনুগ্রহ করে একটি বিভাগ নির্বাচন করুন।';
    }
    const cleanMobile = normalizeMobileNumber(mobile);
    if (!isValidBdMobile(cleanMobile)) {
      nextErrors.mobile = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: ০১৭XXXXXXXX)।';
    }
    if (!address.trim() || address.trim().length < 4) {
      nextErrors.address = 'অনুগ্রহ করে পূর্ণ বর্তমান ঠিকানা লিখুন।';
    }
    return nextErrors;
  };

  const handleAdmissionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const now = new Date();
    let timeFormatted = '';
    try {
      timeFormatted = new Intl.DateTimeFormat('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);
    } catch {
      timeFormatted = toBengaliDigits(now.toLocaleString('en-GB'));
    }

    const submission: AdmissionSubmission = {
      trackingId: generateTrackingId(),
      submittedAt: timeFormatted,
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      dateOfBirth,
      department,
      className,
      residentialType,
      mobile: normalizeMobileNumber(mobile),
      address: address.trim(),
    };

    setLatestSubmission(submission);
    setReceiptModalOpen(true);
  };

  const handleResetForNewApplication = () => {
    setReceiptModalOpen(false);
    setStudentName('');
    setFatherName('');
    setDateOfBirth('');
    setDepartment(DEPARTMENTS[0].name);
    setClassName(DEPARTMENTS[0].classes[0]);
    setResidentialType('আবাসিক (বোর্ডিং)');
    setMobile('');
    setAddress('');
    setErrors({});
  };

  if (showDashboard && studentToken) {
    return (
      <StudentDashboard
        token={studentToken}
        onBackToSite={() => setShowDashboard(false)}
        onLogout={handleStudentLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      {/* 1. Top Utility Bar */}
      <div className="no-print border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-2 px-4 py-2 text-xs text-[#475569] sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-4 lg:px-8">
          {/* Left: Mobile Number & Email Address */}
          <div className="order-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 lg:order-1 lg:justify-start">
            <a
              href="tel:+8801711002233"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[#065F46] tabular-nums whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
              <span>০১৭১১-০০২২৩৩</span>
            </a>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <a
              href="mailto:info@aljamiatul-madrasa.edu.bd"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[#065F46] whitespace-nowrap"
            >
              <Mail className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
              <span>info@aljamiatul-madrasa.edu.bd</span>
            </a>
          </div>

          {/* Center: Arabic Bismillah */}
          <p
            className="order-1 text-center text-base font-normal tracking-wide text-[#B45309] lg:order-2"
            style={{ fontFamily: 'var(--font-arabic)' }}
            dir="rtl"
          >
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>

          {/* Right: Weekday & Hijri/Gregorian Date */}
          <div className="order-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 tabular-nums lg:justify-end">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#065F46]" aria-hidden="true" />
            <span className="font-medium text-[#0F172A]">{weekday}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>{hijri}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>{gregorian}</span>
          </div>
        </div>
      </div>

      {/* 2. Sticky Glassmorphic Navbar */}
      <header className="no-print sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:gap-8 lg:px-8">
          {/* Zone 1: Brand Mark & Wordmark */}
          <a
            href="#home"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46]"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0 text-[#065F46]"
              aria-hidden="true"
            >
              <rect
                x="1.5"
                y="1.5"
                width="29"
                height="29"
                rx="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M16 6.5C12.5 9.2 10.5 12.8 10.5 17V24.5H21.5V17C21.5 12.8 19.5 9.2 16 6.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M16 12.5V20.5M12.5 16.5H19.5"
                stroke="#B45309"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-serif text-base font-bold tracking-tight text-[#0F172A] sm:text-lg">
              আল-জামিয়াতুল ইসলামিয়া
            </span>
          </a>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            aria-label="প্রধান নেভিগেশন"
            className="hidden items-center gap-4 text-[13px] font-medium text-[#475569] lg:flex xl:gap-5 xl:text-sm"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Primary CTA + Student Login + Mobile Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openAdmissionPopup()}
              className="hidden items-center justify-center rounded-lg bg-[#065F46] px-3.5 py-2 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:inline-flex xl:px-4 xl:text-sm"
            >
              অনলাইন ভর্তি
            </button>

            {currentStudent && studentToken ? (
              <button
                type="button"
                onClick={() => setShowDashboard(true)}
                className="hidden items-center justify-center gap-1.5 rounded-lg border border-[#065F46] bg-[#065F46]/5 px-3.5 py-2 text-xs font-semibold text-[#065F46] transition-colors duration-150 hover:bg-[#065F46]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:inline-flex xl:px-4 xl:text-sm"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                <span>ছাত্র ড্যাশবোর্ড</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="hidden items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#0F172A] transition-colors duration-150 hover:border-[#065F46] hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:inline-flex xl:px-4 xl:text-sm"
              >
                <LogIn className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                <span>ছাত্র লগইন</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            className="border-t border-[#E2E8F0] bg-white px-4 py-4 lg:hidden"
          >
            <nav aria-label="মোবাইল নেভিগেশন" className="flex flex-col space-y-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] hover:text-[#065F46]"
                >
                  {link.label}
                </a>
              ))}
              <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAdmissionPopup();
                  }}
                  className="flex w-full items-center justify-center rounded-lg bg-[#065F46] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857]"
                >
                  অনলাইন ভর্তি
                </button>
                {currentStudent && studentToken ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowDashboard(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#065F46] bg-[#065F46]/5 px-4 py-2.5 text-sm font-semibold text-[#065F46]"
                  >
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    <span>ছাত্র ড্যাশবোর্ড</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthModalOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A]"
                  >
                    <LogIn className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span>ছাত্র লগইন</span>
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* 3. Hero Section */}
        <section id="home" className="bg-white py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-12 lg:gap-14">
              {/* Hero Copy */}
              <div className="flex flex-col justify-center lg:col-span-7">
                <p className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[#B45309]">
                  <span className="h-px w-6 bg-[#B45309]" aria-hidden="true" />
                  <span>ভর্তি চলছে · শিক্ষাবর্ষ ১৪৪৭–৪৮ হিজরি</span>
                </p>

                <h1
                  className="mt-5 font-serif text-3xl font-bold leading-[1.25] tracking-tight text-[#0F172A] sm:text-4xl lg:text-[2.85rem]"
                  style={{ textWrap: 'balance' }}
                >
                  আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা
                </h1>

                <p className="mt-3 font-serif text-lg font-medium text-[#065F46] sm:text-xl">
                  ইলমে ওহী, আমল ও আধুনিক শিক্ষার সমন্বিত আদর্শ বিদ্যাপীঠ
                </p>

                <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-[1.0625rem]">
                  বিশুদ্ধ আকীদা ও সুন্নতে নববীর আলোকে আগামী প্রজন্মের নৈতিক ও মেধার বিকাশ ঘটানোই আমাদের মূল ব্রত। নূরানী, হিফজুল কুরআন এবং কিতাব বিভাগের পাশাপাশি যুগোপযোগী সাধারণ ও কারিগরি শিক্ষায় সুসজ্জিত একটি নিরাপদ শিক্ষাঙ্গন।
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => openAdmissionPopup()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#065F46] px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                  >
                    <span>ভর্তি আবেদন করুন</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <a
                    href="#about"
                    className="inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-6 py-3 text-sm font-medium text-[#0F172A] transition-colors duration-150 hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                  >
                    মাদ্রাসা সম্পর্কে জানুন
                  </a>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E2E8F0] pt-6 text-xs text-[#475569]">
                  <span>বেফাকুল মাদারিসিল আরাবিয়া নিবন্ধিত</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>স্থাপিত: ১৯৯৯ খ্রিস্টাব্দ</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>মোহাম্মদপুর, ঢাকা-১২০৭</span>
                </div>
              </div>

              {/* Hero Architectural Showcase Card */}
              <div className="lg:col-span-5">
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="relative aspect-[4/3] w-full flex-1 overflow-hidden bg-slate-100 lg:aspect-auto">
                    {!heroImgFailed ? (
                      <img
                        src="/src/assets/images/hero_madrasa_campus_1794935618315.jpg"
                        alt="আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসার সুশৃঙ্খল ক্যাম্পাস প্রাঙ্গণ"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[260px] flex-col items-center justify-center bg-gradient-to-br from-[#F8FAFC] to-slate-100 p-8 text-center">
                        <BookOpen className="h-10 w-10 text-[#065F46]" aria-hidden="true" />
                        <p className="mt-3 font-serif text-base font-semibold text-[#0F172A]">
                          আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা
                        </p>
                        <p className="mt-1 text-xs text-[#475569]">শান্তিপূর্ণ ও পরিবেশবান্ধব শিক্ষাঙ্গন</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-[#E2E8F0] bg-white px-5 py-4">
                    <div>
                      <p className="text-xs font-medium text-[#B45309]">ক্যাম্পাস পরিচিতি</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#0F172A]">
                        আবাসিক ও অনাবাসিক পূর্ণাঙ্গ ক্যাম্পাস
                      </p>
                    </div>
                    <a
                      href="#departments"
                      className="text-xs font-medium text-[#065F46] underline-offset-4 hover:underline whitespace-nowrap shrink-0"
                    >
                      বিভাগ দেখুন
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Minimalist 4-Column Stat Bar */}
            <div className="mt-14 grid grid-cols-2 divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              {STATS.map((stat) => (
                <div key={stat.label} className="px-6 py-6 text-center sm:text-left">
                  <p className="font-serif text-2xl font-bold text-[#065F46] tabular-nums sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-[#475569]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. About & Principal's Message (মুহতামিমের বাণী) */}
        <section
          id="about"
          className="scroll-mt-16 border-y border-[#E2E8F0] bg-[#F8FAFC] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-14">
              {/* Editorial Library Photo */}
              <div className="lg:col-span-5">
                <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    {!libraryImgFailed ? (
                      <img
                        src="/src/assets/images/madrasa_library_heritage_1794935619165.jpg"
                        alt="মাদ্রাসার কেন্দ্রীয় কুতুবখানা ও গবেষণাগার"
                        referrerPolicy="no-referrer"
                        onError={() => setLibraryImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                        <BookOpen className="h-10 w-10 text-[#065F46]" aria-hidden="true" />
                        <p className="mt-3 text-sm font-medium text-[#0F172A]">
                          কেন্দ্রীয় কুতুবখানা ও দারুল মুতালাআ
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-[#E2E8F0] px-5 py-4">
                    <p className="text-xs font-medium text-[#475569]">
                      দারুল মুতালাআ · ৪,৫০০+ দুর্লভ ও মৌলিক ইসলামী গ্রন্থসমৃদ্ধ পাঠাগার
                    </p>
                  </div>
                </div>
              </div>

              {/* Principal's Message & Core Values */}
              <div className="lg:col-span-7">
                <div className="text-center">
                  <p className="text-sm font-medium text-[#B45309]">আমাদের পরিচিতি ও লক্ষ্য</p>
                  <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                    মুহতামিমের বাণী
                  </h2>
                </div>

                <div className="mt-6 border-y border-[#E2E8F0] py-6">
                  <blockquote className="text-base leading-relaxed text-[#0F172A] sm:text-lg">
                    “বিসমিল্লাহির রাহমানির রাহিম। প্রকৃত শিক্ষা কেবল সনদ অর্জনের মাধ্যম নয়, বরং মানুষের অন্তরকে আলোকিত করা এবং আল্লাহভীরু, যোগ্য ও দায়িত্বশীল মানুষ হিসেবে গড়ে তোলাই ইলমের মূল উদ্দেশ্য। আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা সূচনালগ্ন থেকেই পবিত্র কুরআন ও সুন্নাহর গভীর জ্ঞানের পাশাপাশি সমকালীন বাংলা, ইংরেজি, গণিত ও প্রযুক্তি শিক্ষায় শিক্ষার্থীদের দক্ষ করে তুলতে নিরলস কাজ করে যাচ্ছে।”
                  </blockquote>
                  <div className="mt-5 flex items-center gap-3.5 text-sm">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC]">
                      {!muhtamimImgFailed ? (
                        <img
                          src="/src/assets/images/teacher_muhtamim_1794936349561.jpg"
                          alt="মুহতামিম, আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা"
                          referrerPolicy="no-referrer"
                          onError={() => setMuhtamimImgFailed(true)}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="h-6 w-6 text-[#065F46]" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-[#065F46]">মুহতামিম</p>
                      <p className="text-xs text-[#475569] sm:text-sm">
                        আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা
                      </p>
                    </div>
                  </div>
                </div>

                {/* Core Educational Values */}
                <div className="mt-8 space-y-5">
                  {CORE_VALUES.map((item) => (
                    <div
                      key={item.number}
                      className="flex items-start gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5"
                    >
                      <span className="font-serif text-base font-bold text-[#B45309] tabular-nums shrink-0">
                        {item.number}.
                      </span>
                      <div>
                        <h3 className="font-serif text-base font-semibold text-[#0F172A]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-[#475569]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Academic Departments (বিভাগসমূহ) */}
        <section id="departments" className="scroll-mt-16 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">শিক্ষাক্রম ও বিভাগসমূহ</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                সুসংগঠিত চারটি স্বতন্ত্র শিক্ষা বিভাগ
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                শিক্ষার্থীর বয়স, মেধা ও অভিভাবকের লক্ষ্য অনুযায়ী প্রাথমিক মক্তব থেকে দাওরায়ে হাদিস এবং কারিগরি দক্ষতা অর্জনের জন্য পৃথক সিলেবাস ও অভিজ্ঞ শিক্ষকমণ্ডলী রয়েছে।
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {DEPARTMENTS.map((dept) => (
                <article
                  key={dept.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                      <span className="font-semibold text-[#B45309] tabular-nums">
                        বিভাগ {dept.code}
                      </span>
                      <span className="tabular-nums">
                        {dept.duration} · {dept.ageGroup}
                      </span>
                    </div>

                    <h3 className="mt-3 font-serif text-xl font-bold text-[#0F172A]">
                      {dept.name}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-[#065F46]">{dept.subtitle}</p>

                    <p className="mt-3 text-sm leading-relaxed text-[#475569]">
                      {dept.description}
                    </p>

                    <ul className="mt-5 space-y-2.5 border-t border-[#E2E8F0] pt-4 text-sm text-[#475569]">
                      {dept.highlights.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]"
                            aria-hidden="true"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                    <button
                      type="button"
                      onClick={() => handleSelectDepartmentAndScroll(dept.name)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#065F46] transition-colors hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                    >
                      <span>এই বিভাগে আবেদন করুন</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Interactive Notice Board (নোটিশ বোর্ড) */}
        <section
          id="notices"
          className="scroll-mt-16 border-y border-[#E2E8F0] bg-[#F8FAFC] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-medium text-[#B45309]">প্রশাসনিক ও একাডেমিক ঘোষণা</p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                  নোটিশ বোর্ড
                </h2>
              </div>

              {/* Filter Tabs */}
              <div
                role="tablist"
                aria-label="নোটিশ শ্রেণিবিন্যাস"
                className="inline-flex flex-wrap items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1"
              >
                {NOTICE_FILTERS.map((tab) => {
                  const isActive = noticeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setNoticeFilter(tab.id)}
                      className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:text-sm ${
                        isActive
                          ? 'bg-[#065F46] text-white'
                          : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notices Grid */}
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredNotices.map((notice) => (
                <article
                  key={notice.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                      <span className="font-semibold text-[#065F46]">{notice.category}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="tabular-nums">{notice.date}</span>
                    </div>

                    <h3 className="mt-3 font-serif text-lg font-semibold leading-snug text-[#0F172A]">
                      {notice.title}
                    </h3>

                    <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">
                      {notice.summary}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
                    <span className="truncate text-xs text-[#475569] tabular-nums">
                      {notice.refNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedNotice(notice)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#065F46] transition-colors hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      <span>বিস্তারিত দেখুন</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6.5. Photo Gallery (ফটো গ্যালারি) */}
        <section id="gallery" className="scroll-mt-16 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">ক্যাম্পাস ও শিক্ষাঙ্গনের স্থিরচিত্র</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                ফটো গ্যালারি
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#475569] sm:text-base">
                মাদ্রাসার দৈনন্দিন পাঠদান, হিফজ চর্চা, কম্পিউটার ল্যাব, মসজিদ ও বার্ষিক আয়োজনের বিশেষ মুহূর্তসমূহ।
              </p>
            </div>

            {/* 5-Column Standard Sized Cards (Max 2 rows / 10 photos) */}
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {galleryItems.map((item, index) => (
                <article
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-transform duration-200 hover:-translate-y-1"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="flex h-full w-full flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                      {!failedGalleryIds[item.id] ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedGalleryIds((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-[#F8FAFC] p-4 text-center">
                          <BookOpen className="h-6 w-6 text-[#065F46]" aria-hidden="true" />
                          <span className="mt-2 text-xs text-[#475569]">{item.category}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between border-t border-[#E2E8F0] p-4">
                      <div className="flex items-center gap-1.5 text-xs text-[#475569]">
                        <span className="font-semibold text-[#065F46]">{item.category}</span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="truncate tabular-nums">{item.date}</span>
                      </div>
                      <h3 className="mt-1.5 truncate font-serif text-sm font-semibold text-[#0F172A]">
                        {item.title}
                      </h3>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Teachers & Faculty (আমাদের শিক্ষকমণ্ডলী) */}
        <section id="teachers" className="scroll-mt-16 border-y border-[#E2E8F0] bg-[#F8FAFC] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">অভিজ্ঞ ও নিবেদিতপ্রাণ উস্তাদবৃন্দ</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                আমাদের শিক্ষকমণ্ডলী
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                দেশ-বিদেশের স্বনামধন্য দ্বীনি ও সাধারণ শিক্ষাপ্রতিষ্ঠান থেকে উচ্চতর ডিগ্রিপ্রাপ্ত অভিজ্ঞ উস্তাদ ও শিক্ষকদের নিবিড় তত্ত্বাবধানে পাঠদান পরিচালিত হয়।
              </p>
            </div>

            {/* 3 Cards Per Row */}
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTeachers.map((teacher) => (
                <article
                  key={teacher.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    {!failedTeacherIds[teacher.id] ? (
                      <img
                        src={teacher.photoUrl}
                        alt={teacher.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedTeacherIds((prev) => ({ ...prev, [teacher.id]: true }))
                        }
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
                        <User className="h-10 w-10 text-[#065F46]" aria-hidden="true" />
                        <p className="mt-2 text-xs text-[#475569]">{teacher.department}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between border-t border-[#E2E8F0] p-6">
                    <div>
                      <p className="text-xs font-medium text-[#B45309]">{teacher.department}</p>
                      <h3 className="mt-1.5 font-serif text-lg font-bold text-[#0F172A]">
                        {teacher.name}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-[#065F46]">
                        {teacher.designation}
                      </p>
                      <p className="mt-2.5 text-xs leading-relaxed text-[#475569]">
                        {teacher.qualification}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-[#E2E8F0] pt-4">
                      <span className="text-xs text-[#475569] tabular-nums">
                        {teacher.experience}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTeacher(teacher)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#065F46] transition-colors hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                      >
                        <span>প্রোফাইল দেখুন</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* See More / Collapse Button */}
            {TEACHERS.length > 3 && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllTeachers((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-6 py-3 text-sm font-medium text-[#0F172A] transition-colors duration-150 hover:border-[#065F46] hover:bg-[#F8FAFC] hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                >
                  {showAllTeachers ? (
                    <>
                      <span>সংক্ষিপ্ত করুন</span>
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>
                        আরও শিক্ষক দেখুন ({toBengaliDigits(TEACHERS.length - 3)} জন)
                      </span>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 8. Admission Process & Interactive Online Form */}
        <section id="admission" className="scroll-mt-16 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">ভর্তি নির্দেশিকা · ১৪৪৭–৪৮ হিজরি</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                ভর্তি প্রক্রিয়া ও অনলাইন আবেদন
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                সহজ চারটি ধাপে আপনার সন্তানের ভর্তি প্রক্রিয়া সম্পন্ন করুন। অনলাইনে আবেদন জমা দেওয়ার সাথে সাথেই একটি ট্র্যাকিং আইডিসহ প্রিন্টযোগ্য প্রাপ্তি স্বীকারপত্র পাবেন।
              </p>
            </div>

            {/* 4-Step Horizontal Process */}
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {ADMISSION_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6"
                >
                  <p className="font-serif text-lg font-bold text-[#B45309] tabular-nums">
                    ধাপ {item.step}
                  </p>
                  <h3 className="mt-2 font-serif text-base font-semibold text-[#0F172A]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Online Admission Form Card */}
            <div
              id="admission-form"
              className="mt-14 scroll-mt-24 rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-10"
            >
              <div className="flex flex-col items-center gap-4 border-b border-[#E2E8F0] pb-6 text-center">
                <div className="mx-auto max-w-2xl text-center">
                  <h3 className="font-serif text-xl font-bold text-[#0F172A] sm:text-2xl">
                    অনলাইন ভর্তি আবেদন ফরম
                  </h3>
                  <p className="mt-1 text-sm text-[#475569]">
                    তারকাচিহ্নিত (*) সকল ঘর সঠিকভাবে পূরণ করুন।
                  </p>
                </div>

                {latestSubmission && (
                  <button
                    type="button"
                    onClick={() => setReceiptModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#065F46]/30 bg-[#065F46]/5 px-4 py-2 text-xs font-semibold text-[#065F46] transition-colors hover:bg-[#065F46]/10 whitespace-nowrap shrink-0 sm:text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>সর্বশেষ রশিদ দেখুন ({latestSubmission.trackingId})</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleAdmissionSubmit} noValidate className="mt-8 space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Student Name */}
                  <div>
                    <label
                      htmlFor="studentName"
                      className="block text-sm font-medium text-[#0F172A]"
                    >
                      শিক্ষার্থীর পূর্ণ নাম <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="studentName"
                      name="studentName"
                      type="text"
                      value={studentName}
                      onChange={(e) => {
                        setStudentName(e.target.value);
                        if (errors.studentName) {
                          setErrors((prev) => ({ ...prev, studentName: undefined }));
                        }
                      }}
                      placeholder="যেমন: মুহাম্মদ আব্দুল্লাহ আল-মামুন"
                      className={`mt-2 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        errors.studentName
                          ? 'border-red-600 focus:ring-red-600/20'
                          : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                      }`}
                    />
                    {errors.studentName && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.studentName}
                      </p>
                    )}
                  </div>

                  {/* Father's Name */}
                  <div>
                    <label
                      htmlFor="fatherName"
                      className="block text-sm font-medium text-[#0F172A]"
                    >
                      পিতার পূর্ণ নাম <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="fatherName"
                      name="fatherName"
                      type="text"
                      value={fatherName}
                      onChange={(e) => {
                        setFatherName(e.target.value);
                        if (errors.fatherName) {
                          setErrors((prev) => ({ ...prev, fatherName: undefined }));
                        }
                      }}
                      placeholder="যেমন: মাওলানা আব্দুর রহমান"
                      className={`mt-2 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        errors.fatherName
                          ? 'border-red-600 focus:ring-red-600/20'
                          : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                      }`}
                    />
                    {errors.fatherName && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.fatherName}
                      </p>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label
                      htmlFor="dateOfBirth"
                      className="block text-sm font-medium text-[#0F172A]"
                    >
                      জন্ম তারিখ <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      max="2023-12-31"
                      value={dateOfBirth}
                      onChange={(e) => {
                        setDateOfBirth(e.target.value);
                        if (errors.dateOfBirth) {
                          setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
                        }
                      }}
                      className={`mt-2 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 ${
                        errors.dateOfBirth
                          ? 'border-red-600 focus:ring-red-600/20'
                          : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                      }`}
                    />
                    {errors.dateOfBirth && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.dateOfBirth}
                      </p>
                    )}
                  </div>

                  {/* Desired Department */}
                  <div>
                    <label
                      htmlFor="department"
                      className="block text-sm font-medium text-[#0F172A]"
                    >
                      বিভাগ নির্বাচন করুন <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="department"
                      name="department"
                      value={department}
                      onChange={(e) => {
                        const nextDept = e.target.value;
                        setDepartment(nextDept);
                        const matched = DEPARTMENTS.find((d) => d.name === nextDept);
                        if (matched && matched.classes.length > 0) {
                          setClassName(matched.classes[0]);
                        }
                        if (errors.department) {
                          setErrors((prev) => ({ ...prev, department: undefined }));
                        }
                      }}
                      className={`mt-2 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 ${
                        errors.department
                          ? 'border-red-600 focus:ring-red-600/20'
                          : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                      }`}
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name} ({dept.duration})
                        </option>
                      ))}
                    </select>
                    {errors.department && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.department}
                      </p>
                    )}
                  </div>

                  {/* Desired Class / Jamat */}
                  <div>
                    <label
                      htmlFor="inline-className"
                      className="block text-sm font-medium text-[#0F172A]"
                    >
                      ভর্তির ক্লাস / জামাত <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="inline-className"
                      name="className"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                    >
                      {inlineAvailableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Residential Type */}
                  <div>
                    <span className="block text-sm font-medium text-[#0F172A]">
                      আবাসন ধরন <span className="text-red-600">*</span>
                    </span>
                    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {RESIDENTIAL_TYPES.map((option) => {
                        const selected = residentialType === option;
                        return (
                          <label
                            key={option}
                            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                              selected
                                ? 'border-[#065F46] bg-[#065F46]/5 text-[#065F46]'
                                : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="residentialType"
                              value={option}
                              checked={selected}
                              onChange={() => setResidentialType(option)}
                              className="sr-only"
                            />
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                selected ? 'bg-[#065F46]' : 'bg-slate-300'
                              }`}
                              aria-hidden="true"
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label
                      htmlFor="mobile"
                      className="block text-sm font-medium text-[#0F172A]"
                    >
                      অভিভাবকের মোবাইল নম্বর <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value);
                        if (errors.mobile) {
                          setErrors((prev) => ({ ...prev, mobile: undefined }));
                        }
                      }}
                      placeholder="017XXXXXXXX"
                      className={`mt-2 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 tabular-nums focus:outline-none focus:ring-2 ${
                        errors.mobile
                          ? 'border-red-600 focus:ring-red-600/20'
                          : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                      }`}
                    />
                    {errors.mobile && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.mobile}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-[#0F172A]"
                  >
                    বর্তমান ও স্থায়ী ঠিকানা <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errors.address) {
                        setErrors((prev) => ({ ...prev, address: undefined }));
                      }
                    }}
                    placeholder="বাড়ি/গ্রাম, সড়ক, ডাকঘর, থানা ও জেলা উল্লেখ করুন"
                    className={`mt-2 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                      errors.address
                        ? 'border-red-600 focus:ring-red-600/20'
                        : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                    }`}
                  />
                  {errors.address && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.address}</p>
                  )}
                </div>

                <div className="flex flex-col items-start justify-between gap-4 border-t border-[#E2E8F0] pt-6 sm:flex-row sm:items-center">
                  <p className="text-xs leading-relaxed text-[#475569]">
                    আবেদন জমা দেওয়ার পর প্রাপ্ত ট্র্যাকিং আইডি সংরক্ষণ করুন এবং সাক্ষাৎকারের দিন সাথে আনুন।
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#065F46] px-7 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                  >
                    <span>আবেদন জমা দিন ও রশিদ নিন</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Clean Minimal 4-Column Footer */}
      <footer id="contact" className="no-print scroll-mt-16 border-t border-[#E2E8F0] bg-[#F8FAFC] pt-16 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Madrasa Info */}
            <div>
              <p className="font-serif text-lg font-bold text-[#0F172A]">
                আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#475569]">
                পবিত্র কুরআন ও সুন্নাহর বিশুদ্ধ শিক্ষার পাশাপাশি আধুনিক ও কারিগরি দক্ষতায় সমৃদ্ধ একটি আদর্শ দ্বীনি শিক্ষাপ্রতিষ্ঠান।
              </p>
              <p className="mt-4 text-xs text-[#475569]">
                বেফাক নিবন্ধন নং: ১২৪৮৫ · স্থাপিত ১৯৯৯ খ্রি.
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0F172A]">দ্রুত লিংক</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#475569]">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="transition-colors hover:text-[#065F46]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Campus Address & Map Link */}
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0F172A]">ক্যাম্পাস ঠিকানা</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#475569]">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <span>বাড়ি নং ৪২, মাদ্রাসা রোড, মোহাম্মদপুর, ঢাকা-১২০৭</span>
                </li>
                <li className="flex items-center gap-2.5 tabular-nums">
                  <Phone className="h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <a href="tel:+8801711002233" className="hover:text-[#065F46]">
                    +৮৮০ ১৭১১-০০২২৩৩
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <a
                    href="mailto:info@aljamiatul-madrasa.edu.bd"
                    className="break-all hover:text-[#065F46]"
                  >
                    info@aljamiatul-madrasa.edu.bd
                  </a>
                </li>
              </ul>
              <a
                href="https://maps.google.com/?q=Mohammadpur,Dhaka+1207"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#065F46] underline-offset-4 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>গুগল ম্যাপে অবস্থান দেখুন</span>
              </a>
            </div>

            {/* Column 4: Office Hours */}
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0F172A]">অফিস ও সাক্ষাৎ সময়</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#475569]">
                <li className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-[#0F172A]">শনিবার – বৃহস্পতিবার</p>
                    <p className="tabular-nums">সকাল ৮:০০ – বিকাল ৪:০০</p>
                  </div>
                </li>
                <li className="border-t border-[#E2E8F0] pt-2.5">
                  <p className="font-medium text-[#0F172A]">ভর্তি সাক্ষাৎকার</p>
                  <p className="tabular-nums">সকাল ৯:০০ – দুপুর ১:০০</p>
                </li>
                <li className="text-xs text-[#B45309]">শুক্রবার সাপ্তাহিক ছুটি</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#E2E8F0] pt-6 text-xs text-[#475569] sm:flex-row">
            <p>© ২০২৬ আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা। সর্বস্বত্ব সংরক্ষিত।</p>
            <p>শিক্ষা · আদব · তাকওয়া</p>
          </div>
        </div>
      </footer>

      {/* Interactive Modals */}
      <NoticeModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />

      <ReceiptModal
        submission={receiptModalOpen ? latestSubmission : null}
        onClose={() => setReceiptModalOpen(false)}
        onNewApplication={handleResetForNewApplication}
      />

      <GalleryLightboxModal
        items={galleryItems}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />

      <TeacherProfileModal
        teacher={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
      />

      <StudentAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleStudentAuthSuccess}
      />

      <AdmissionFormModal
        isOpen={admissionModalOpen}
        initialDepartment={admissionInitialDept}
        onClose={() => setAdmissionModalOpen(false)}
        onSubmitted={(submission) => {
          setLatestSubmission(submission);
          setAdmissionModalOpen(false);
          setReceiptModalOpen(true);
        }}
      />
    </div>
  );
}
