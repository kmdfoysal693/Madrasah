import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Archive,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  generateTrackingId,
  isValidBdMobile,
  normalizeMobileNumber,
  toBengaliDigits,
  type AdmissionSubmission,
  type Department,
  type GalleryItem,
  type NoticeCategory,
  type NoticeItem,
  type TeacherProfile,
} from './data/madrasaData';
import {
  ADMISSION_STEPS_EN,
  GALLERY_CATEGORY_EN,
  NOTICE_CATEGORY_EN,
  RESIDENTIAL_OPTIONS,
  UI_COPY,
  formatDigits,
  getLocalizedFormattedDates,
  type Language,
  type ResidentialKey,
} from './data/madrasaTranslations';
import type { SiteCmsData } from './data/cmsTypes';
import { DEFAULT_CMS_DATA } from './data/defaultCmsSeed';
import type { StudentUser } from './data/studentPortalData';
import { NoticeModal } from './components/NoticeModal';
import { ReceiptModal } from './components/ReceiptModal';
import { GalleryLightboxModal } from './components/GalleryModals';
import { TeacherProfileModal } from './components/TeacherProfileModal';
import { StudentAuthModal } from './components/StudentAuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdmissionFormModal } from './components/AdmissionFormModal';
import { LanguageToggle } from './components/LanguageToggle';

type NoticeFilter = 'সকল' | NoticeCategory;

interface FormErrors {
  studentName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  department?: string;
  mobile?: string;
  address?: string;
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('madrasa_lang');
      return saved === 'en' ? 'en' : 'bn';
    } catch {
      return 'bn';
    }
  });

  const [cmsData, setCmsData] = useState<SiteCmsData>(DEFAULT_CMS_DATA);

  const copy = UI_COPY[lang];
  const siteSettings = cmsData.siteSettings;
  const heroCms = cmsData.heroSection;
  const aboutCms = cmsData.aboutSection;

  const activeBrandShort =
    lang === 'en'
      ? siteSettings.brandShortEn || copy.brandShort
      : siteSettings.brandShortBn || copy.brandShort;
  const activeBrandFull =
    lang === 'en'
      ? siteSettings.brandFullEn || copy.brandFull
      : siteSettings.brandFullBn || copy.brandFull;
  const activePhoneDisplay =
    lang === 'en'
      ? siteSettings.phoneEn || copy.phoneDisplay
      : siteSettings.phoneBn || copy.phoneDisplay;
  const activeEmail = siteSettings.email || 'info@aljamiatul-madrasa.edu.bd';
  const activeAddress =
    lang === 'en'
      ? siteSettings.addressEn || copy.footerAddress
      : siteSettings.addressBn || copy.footerAddress;

  useEffect(() => {
    try {
      localStorage.setItem('madrasa_lang', lang);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = lang;
    document.title =
      lang === 'en'
        ? `${activeBrandFull} — Official Website`
        : `${activeBrandFull} — অফিসিয়াল ওয়েবসাইট`;
  }, [lang, activeBrandFull]);

  const lastCmsUpdatedAtRef = useRef<string>('');

  const applyCmsSnapshot = useCallback((nextCms: SiteCmsData) => {
    if (nextCms.updatedAt && nextCms.updatedAt === lastCmsUpdatedAtRef.current) {
      return;
    }
    lastCmsUpdatedAtRef.current = nextCms.updatedAt || '';
    setCmsData(nextCms);
  }, []);

  const fetchLatestCms = useCallback(async () => {
    try {
      const res = await fetch('/api/cms', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { cms?: SiteCmsData };
      if (data.cms) {
        applyCmsSnapshot(data.cms);
      }
    } catch {
      // Fallback smoothly to current/default CMS data if offline
    }
  }, [applyCmsSnapshot]);

  useEffect(() => {
    void fetchLatestCms();

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchLatestCms();
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'madrasa_cms_updated_at') {
        void fetchLatestCms();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('storage', handleStorage);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('madrasa_cms_sync');
        channel.onmessage = (event: MessageEvent<{ cms?: SiteCmsData }>) => {
          if (event.data?.cms) {
            applyCmsSnapshot(event.data.cms);
          } else {
            void fetchLatestCms();
          }
        };
      }
    } catch {
      channel = null;
    }

    let eventSource: EventSource | null = null;
    try {
      if (typeof EventSource !== 'undefined') {
        eventSource = new EventSource('/api/cms/stream');
        const handleSseCms = (evt: MessageEvent<string>) => {
          try {
            const parsed = JSON.parse(evt.data) as { cms?: SiteCmsData };
            if (parsed.cms) {
              applyCmsSnapshot(parsed.cms);
            }
          } catch {
            // ignore malformed SSE event payload
          }
        };
        eventSource.addEventListener('cms-sync', handleSseCms as EventListener);
        eventSource.addEventListener('cms-updated', handleSseCms as EventListener);
      }
    } catch {
      eventSource = null;
    }

    // Fallback check when tab is visible and SSE is temporarily disconnected
    const fallbackTimer = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        (!eventSource || eventSource.readyState !== EventSource.OPEN)
      ) {
        void fetchLatestCms();
      }
    }, 8000);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(fallbackTimer);
      if (channel) {
        channel.close();
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [applyCmsSnapshot, fetchLatestCms]);

  const activeHeroSlides = useMemo(
    () =>
      heroCms.slides.length > 0 ? heroCms.slides : DEFAULT_CMS_DATA.heroSection.slides,
    [heroCms.slides],
  );

  const activeStats = useMemo(
    () =>
      heroCms.stats.map((s) => ({
        value: lang === 'en' ? s.valueEn : s.valueBn,
        label: lang === 'en' ? s.labelEn : s.labelBn,
      })),
    [heroCms.stats, lang],
  );

  const activeCoreValues = useMemo(
    () =>
      aboutCms.coreValues.map((cv) => ({
        number: lang === 'en' ? cv.numberEn : cv.numberBn,
        title: lang === 'en' ? cv.titleEn : cv.titleBn,
        description: lang === 'en' ? cv.descriptionEn : cv.descriptionBn,
      })),
    [aboutCms.coreValues, lang],
  );

  const bnDepartments: Department[] = useMemo(
    () =>
      cmsData.departments.map((d) => ({
        id: d.id,
        code: d.codeBn,
        name: d.nameBn,
        subtitle: d.subtitleBn,
        duration: d.durationBn,
        ageGroup: d.ageGroupBn,
        description: d.descriptionBn,
        highlights: d.highlightsBn,
        classes: d.classesBn,
      })),
    [cmsData.departments],
  );

  const enDepartments: Department[] = useMemo(
    () =>
      cmsData.departments.map((d) => ({
        id: d.id,
        code: d.codeEn,
        name: d.nameEn,
        subtitle: d.subtitleEn,
        duration: d.durationEn,
        ageGroup: d.ageGroupEn,
        description: d.descriptionEn,
        highlights: d.highlightsEn,
        classes: d.classesEn,
      })),
    [cmsData.departments],
  );

  const activeDepartments = lang === 'en' ? enDepartments : bnDepartments;

  const allMappedNotices = useMemo(
    () =>
      cmsData.notices.map((n) => ({
        id: n.id,
        status: n.status,
        category: n.category,
        date: lang === 'en' ? n.dateEn : n.dateBn,
        hijriDate: lang === 'en' ? n.hijriDateEn : n.hijriDateBn,
        refNumber: n.refNumber,
        title: lang === 'en' ? n.titleEn : n.titleBn,
        summary: lang === 'en' ? n.summaryEn : n.summaryBn,
        fullText: lang === 'en' ? n.fullTextEn : n.fullTextBn,
        issuedBy: lang === 'en' ? n.issuedByEn : n.issuedByBn,
      })),
    [cmsData.notices, lang],
  );

  const activeNotices: NoticeItem[] = useMemo(
    () => allMappedNotices.filter((n) => n.status !== 'archived'),
    [allMappedNotices],
  );

  const archivedNotices: NoticeItem[] = useMemo(
    () => allMappedNotices.filter((n) => n.status === 'archived'),
    [allMappedNotices],
  );

  const activeGalleryItems: GalleryItem[] = useMemo(
    () =>
      cmsData.gallery.map((g) => ({
        id: g.id,
        title: lang === 'en' ? g.titleEn : g.titleBn,
        category: g.category,
        date: lang === 'en' ? g.dateEn : g.dateBn,
        imageUrl: g.imageUrl,
      })),
    [cmsData.gallery, lang],
  );

  const activeTeachers: TeacherProfile[] = useMemo(
    () =>
      cmsData.teachers.map((t) => ({
        id: t.id,
        name: lang === 'en' ? t.nameEn : t.nameBn,
        designation: lang === 'en' ? t.designationEn : t.designationBn,
        department: lang === 'en' ? t.departmentEn : t.departmentBn,
        qualification: lang === 'en' ? t.qualificationEn : t.qualificationBn,
        experience: lang === 'en' ? t.experienceEn : t.experienceBn,
        subjects: lang === 'en' ? t.subjectsEn : t.subjectsBn,
        bio: lang === 'en' ? t.bioEn : t.bioBn,
        photoUrl: t.photoUrl,
      })),
    [cmsData.teachers, lang],
  );

  const activeAdmissionSteps = lang === 'en' ? ADMISSION_STEPS_EN : ADMISSION_STEPS;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState<NoticeFilter>('সকল');
  const [noticeArchiveMode, setNoticeArchiveMode] = useState<'active' | 'archived'>('active');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [failedHeroSlides, setFailedHeroSlides] = useState<Record<string, boolean>>({});
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [libraryImgFailed, setLibraryImgFailed] = useState(false);
  const [muhtamimImgFailed, setMuhtamimImgFailed] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [failedGalleryIds, setFailedGalleryIds] = useState<Record<string, boolean>>({});
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
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
    setLogoImgFailed(false);
  }, [siteSettings.logoUrl]);

  useEffect(() => {
    setLibraryImgFailed(false);
  }, [aboutCms.libraryPhotoUrl]);

  useEffect(() => {
    setMuhtamimImgFailed(false);
  }, [aboutCms.muhtamimPhotoUrl]);

  useEffect(() => {
    setFailedHeroSlides({});
  }, [activeHeroSlides]);

  useEffect(() => {
    if (noticeArchiveMode === 'archived' && archivedNotices.length === 0) {
      setNoticeArchiveMode('active');
    }
  }, [noticeArchiveMode, archivedNotices.length]);

  const selectedNotice = useMemo(
    () => allMappedNotices.find((n) => n.id === selectedNoticeId) ?? null,
    [allMappedNotices, selectedNoticeId],
  );
  const selectedTeacher = useMemo(
    () => activeTeachers.find((t) => t.id === selectedTeacherId) ?? null,
    [activeTeachers, selectedTeacherId],
  );

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
  const defaultDeptId = activeDepartments[0]?.id ?? DEFAULT_CMS_DATA.departments[0].id;
  const [admissionModalOpen, setAdmissionModalOpen] = useState(false);
  const [admissionInitialDeptId, setAdmissionInitialDeptId] = useState<string>(defaultDeptId);
  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [departmentId, setDepartmentId] = useState(defaultDeptId);
  const [classIndex, setClassIndex] = useState(0);
  const [residentialKey, setResidentialKey] = useState<ResidentialKey>('boarding');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [inlineSubmitError, setInlineSubmitError] = useState('');
  const [latestSubmission, setLatestSubmission] = useState<AdmissionSubmission | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  useEffect(() => {
    if (activeDepartments.length === 0) return;
    if (!activeDepartments.some((d) => d.id === departmentId)) {
      setDepartmentId(activeDepartments[0].id);
      setClassIndex(0);
    }
  }, [activeDepartments, departmentId]);

  const selectedInlineDept = useMemo(
    () => activeDepartments.find((d) => d.id === departmentId) ?? activeDepartments[0],
    [activeDepartments, departmentId],
  );

  const openAdmissionPopup = (deptId?: string) => {
    setAdmissionInitialDeptId(deptId ?? defaultDeptId);
    setAdmissionModalOpen(true);
  };

  const isAnyModalOpen =
    Boolean(selectedNoticeId) ||
    receiptModalOpen ||
    lightboxIndex !== null ||
    Boolean(selectedTeacherId) ||
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

  useEffect(() => {
    if (heroPaused || isAnyModalOpen || showDashboard) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const timer = window.setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % activeHeroSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [heroPaused, isAnyModalOpen, showDashboard, activeHeroSlides.length]);

  const safeHeroIndex = activeHeroSlide % activeHeroSlides.length;
  const currentHeroSlide = activeHeroSlides[safeHeroIndex] ?? activeHeroSlides[0];
  const goToPrevHeroSlide = () => {
    setActiveHeroSlide((prev) => (prev - 1 + activeHeroSlides.length) % activeHeroSlides.length);
  };
  const goToNextHeroSlide = () => {
    setActiveHeroSlide((prev) => (prev + 1) % activeHeroSlides.length);
  };

  const { weekday, gregorian, hijri } = useMemo(
    () => getLocalizedFormattedDates(lang),
    [lang],
  );

  const displayedNoticesPool = useMemo(
    () => (noticeArchiveMode === 'archived' && archivedNotices.length > 0 ? archivedNotices : activeNotices),
    [noticeArchiveMode, archivedNotices, activeNotices],
  );

  const filteredNotices = useMemo(() => {
    return noticeFilter === 'সকল'
      ? displayedNoticesPool
      : displayedNoticesPool.filter((item) => item.category === noticeFilter);
  }, [displayedNoticesPool, noticeFilter]);

  const galleryItems = activeGalleryItems;

  const visibleTeachers = useMemo(
    () => (showAllTeachers ? activeTeachers : activeTeachers.slice(0, 3)),
    [activeTeachers, showAllTeachers],
  );

  const handleSelectDepartmentAndScroll = (deptId: string) => {
    openAdmissionPopup(deptId);
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!studentName.trim() || studentName.trim().length < 2) {
      nextErrors.studentName = copy.validation.studentName;
    }
    if (!fatherName.trim() || fatherName.trim().length < 2) {
      nextErrors.fatherName = copy.validation.fatherName;
    }
    if (!dateOfBirth) {
      nextErrors.dateOfBirth = copy.validation.dob;
    }
    if (!departmentId) {
      nextErrors.department = copy.validation.dept;
    }
    const cleanMobile = normalizeMobileNumber(mobile);
    if (!isValidBdMobile(cleanMobile)) {
      nextErrors.mobile = copy.validation.mobile;
    }
    if (!address.trim() || address.trim().length < 4) {
      nextErrors.address = copy.validation.address;
    }
    return nextErrors;
  };

  const handleAdmissionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInlineSubmitError('');
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const now = new Date();
    let timeFormatted = '';
    try {
      timeFormatted = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);
    } catch {
      timeFormatted =
        lang === 'en'
          ? now.toLocaleString('en-US')
          : toBengaliDigits(now.toLocaleString('en-GB'));
    }

    const bnDept =
      bnDepartments.find((d) => d.id === selectedInlineDept?.id) ??
      bnDepartments[0] ?? {
        id: 'dept',
        name: selectedInlineDept?.name ?? '',
        classes: selectedInlineDept?.classes ?? [],
      };
    const resObj =
      RESIDENTIAL_OPTIONS.find((r) => r.key === residentialKey) ?? RESIDENTIAL_OPTIONS[0];

    const submission: AdmissionSubmission = {
      trackingId: generateTrackingId(),
      submittedAt: timeFormatted,
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      dateOfBirth,
      department: bnDept.name,
      departmentId: selectedInlineDept?.id ?? bnDept.id,
      className: bnDept.classes[classIndex] ?? bnDept.classes[0] ?? '',
      classIndex,
      residentialType: resObj.bn,
      residentialKey,
      mobile: normalizeMobileNumber(mobile),
      address: address.trim(),
    };

    setInlineSubmitting(true);
    try {
      const response = await fetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        setInlineSubmitError(
          errData.error ??
            (lang === 'en'
              ? 'Failed to save admission application. Please try again.'
              : 'ভর্তি আবেদন সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'),
        );
        return;
      }
      setLatestSubmission(submission);
      setReceiptModalOpen(true);
    } catch {
      setInlineSubmitError(
        lang === 'en'
          ? 'Network error while saving admission application.'
          : 'সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      );
    } finally {
      setInlineSubmitting(false);
    }
  };

  const handleResetForNewApplication = () => {
    setReceiptModalOpen(false);
    setStudentName('');
    setFatherName('');
    setDateOfBirth('');
    setDepartmentId(defaultDeptId);
    setClassIndex(0);
    setResidentialKey('boarding');
    setMobile('');
    setAddress('');
    setErrors({});
    setInlineSubmitError('');
  };


  if (showDashboard && studentToken) {
    return (
      <StudentDashboard
        token={studentToken}
        lang={lang}
        notices={activeNotices}
        brandShort={activeBrandShort}
        onChangeLang={setLang}
        onBackToSite={() => setShowDashboard(false)}
        onLogout={handleStudentLogout}
      />
    );
  }

  const telHref = `tel:+88${normalizeMobileNumber(siteSettings.phoneEn || siteSettings.phoneBn || '01711002233')}`;

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      {/* 1. Top Utility Bar */}
      <div className="no-print border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-2 px-4 py-2 text-xs text-[#475569] sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-4 lg:px-8">
          {/* Left: Mobile Number & Email Address */}
          <div className="order-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 lg:order-1 lg:justify-start">
            <a
              href={telHref}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[#065F46] tabular-nums whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
              <span>{activePhoneDisplay}</span>
            </a>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <a
              href={`mailto:${activeEmail}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[#065F46] whitespace-nowrap"
            >
              <Mail className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
              <span>{activeEmail}</span>
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 xl:gap-6">
          {/* Zone 1: Brand Mark & Wordmark */}
          <a
            href="#home"
            className="flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46]"
          >
            {siteSettings.logoUrl && !logoImgFailed ? (
              <img
                src={siteSettings.logoUrl}
                alt={activeBrandShort}
                onError={() => setLogoImgFailed(true)}
                className="h-8 w-8 shrink-0 rounded-md border border-[#E2E8F0] bg-white object-contain p-0.5"
              />
            ) : (
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
            )}
            <span className="font-serif text-sm font-bold tracking-tight text-[#0F172A] sm:text-base xl:text-lg">
              {activeBrandShort}
            </span>
          </a>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden items-center gap-2.5 text-[12px] font-medium text-[#475569] lg:flex xl:gap-4 xl:text-sm"
          >
            {copy.navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Online Admission + Ban-Eng Toggle + Student Login + Mobile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openAdmissionPopup()}
              className="hidden items-center justify-center rounded-lg bg-[#065F46] px-3 py-2 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:inline-flex xl:px-4 xl:text-sm"
            >
              {copy.ctaOnlineAdmission}
            </button>

            {/* Ban | Eng Switcher positioned directly between Online Admission and Student Login */}
            <LanguageToggle lang={lang} onChange={setLang} />

            {currentStudent && studentToken ? (
              <button
                type="button"
                onClick={() => setShowDashboard(true)}
                className="hidden items-center justify-center gap-1.5 rounded-lg border border-[#065F46] bg-[#065F46]/5 px-3 py-2 text-xs font-semibold text-[#065F46] transition-colors duration-150 hover:bg-[#065F46]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:inline-flex xl:px-4 xl:text-sm"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                <span>{copy.ctaStudentDashboard}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="hidden items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors duration-150 hover:border-[#065F46] hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0 sm:inline-flex xl:px-4 xl:text-sm"
              >
                <LogIn className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                <span>{copy.ctaStudentLogin}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? copy.menuCloseAria : copy.menuOpenAria}
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
            <nav aria-label="Mobile Navigation" className="flex flex-col space-y-1">
              {copy.navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] hover:text-[#065F46]"
                >
                  {link.label}
                </a>
              ))}
              <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAdmissionPopup();
                  }}
                  className="flex w-full items-center justify-center rounded-lg bg-[#065F46] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857]"
                >
                  {copy.ctaOnlineAdmission}
                </button>
                <div className="flex items-center">
                  <LanguageToggle lang={lang} onChange={setLang} fullWidth />
                </div>
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
                    <span>{copy.ctaStudentDashboard}</span>
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
                    <span>{copy.ctaStudentLogin}</span>
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* 3. Panoramic Hero Showcase with Multi-Photo Campus Carousel */}
        <section
          id="home"
          className="relative overflow-hidden bg-white"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
        >
          {/* Desktop Right-Bleed Multi-Photo Stage with Soft Curved White Fade */}
          <div className="relative lg:min-h-[560px] xl:min-h-[600px]">
            {/* Background Image Layer (Desktop lg+) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[68%] overflow-hidden bg-slate-100 lg:block xl:w-[66%]"
            >
              {activeHeroSlides.map((slide, idx) => {
                const isActive = idx === safeHeroIndex;
                const slideFailed = failedHeroSlides[slide.id];
                return (
                  <div
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {!slideFailed ? (
                      <img
                        src={slide.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedHeroSlides((prev) => ({ ...prev, [slide.id]: true }))
                        }
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ECFDF5] to-slate-100" />
                    )}
                  </div>
                );
              })}

              {/* Soft White Left Fade & Subtle Curved Sweep Matching Reference Architecture */}
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 via-[26%] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/60 to-transparent" />
              <svg
                viewBox="0 0 400 600"
                preserveAspectRatio="none"
                className="absolute inset-y-0 left-0 h-full w-56 text-white"
              >
                <path
                  d="M0,0 L210,0 C120,175 110,415 245,600 L0,600 Z"
                  fill="currentColor"
                  fillOpacity="0.92"
                />
                <path
                  d="M210,0 C120,175 110,415 245,600 L295,600 C165,415 175,175 265,0 Z"
                  fill="currentColor"
                  fillOpacity="0.32"
                />
              </svg>
            </div>

            {/* Foreground Content + Multi-Photo Controls Container */}
            <div className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14 lg:flex lg:min-h-[560px] lg:items-end lg:justify-between lg:gap-10 lg:px-8 lg:pb-16 lg:pt-16 xl:min-h-[600px]">
              {/* Left Copy Column */}
              <div className="flex flex-col justify-center lg:max-w-[52%] lg:self-center xl:max-w-[49%]">
                <p className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#065F46] sm:text-sm">
                  <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{lang === 'en' ? heroCms.welcomeEn : heroCms.welcomeBn}</span>
                </p>

                <h1
                  className="mt-5 font-serif text-3xl font-bold leading-[1.18] tracking-tight sm:text-4xl lg:text-[2.95rem] xl:text-[3.25rem]"
                  style={{ textWrap: 'balance' }}
                >
                  <span className="block text-[#065F46]">
                    {lang === 'en' ? heroCms.headlineLine1En : heroCms.headlineLine1Bn}
                  </span>
                  <span className="mt-1 block text-[#0F172A]">
                    {lang === 'en' ? heroCms.headlineLine2En : heroCms.headlineLine2Bn}
                  </span>
                </h1>

                <p className="mt-4 font-serif text-base font-medium text-[#065F46] sm:text-lg">
                  {lang === 'en' ? heroCms.subtitleEn : heroCms.subtitleBn}
                </p>

                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#475569] sm:text-base">
                  {lang === 'en' ? heroCms.descriptionEn : heroCms.descriptionBn}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => openAdmissionPopup()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#065F46] px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                  >
                    <span>{copy.heroApplyBtn}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <a
                    href="#about"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#065F46]/35 bg-white/95 px-6 py-3 text-sm font-semibold text-[#065F46] transition-colors duration-150 hover:bg-[#ECFDF5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <span>{copy.heroAboutBtn}</span>
                  </a>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E2E8F0] pt-5 text-xs text-[#475569]">
                  <span className="font-medium text-[#B45309]">
                    {lang === 'en' ? heroCms.badgeEn : heroCms.badgeBn}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>{copy.heroTrust[0]}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>{copy.heroTrust[1]}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>{copy.heroTrust[2]}</span>
                </div>
              </div>

              {/* Mobile & Tablet Clean Photo Carousel (< lg) */}
              <div className="mt-8 overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] lg:hidden">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {activeHeroSlides.map((slide, idx) => {
                    const isActive = idx === safeHeroIndex;
                    const slideFailed = failedHeroSlides[slide.id];
                    return (
                      <div
                        key={slide.id}
                        className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${
                          isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        {!slideFailed ? (
                          <img
                            src={slide.imageUrl}
                            alt={lang === 'en' ? slide.altEn : slide.altBn}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedHeroSlides((prev) => ({ ...prev, [slide.id]: true }))
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#F8FAFC] to-slate-100 p-6 text-center">
                            <BookOpen className="h-9 w-9 text-[#065F46]" aria-hidden="true" />
                            <p className="mt-2 font-serif text-sm font-semibold text-[#0F172A]">
                              {activeBrandFull}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 text-white">
                    <p className="text-xs font-medium text-emerald-200 tabular-nums">
                      {formatDigits(safeHeroIndex + 1, lang)} /{' '}
                      {formatDigits(activeHeroSlides.length, lang)}
                    </p>
                    <p className="mt-0.5 font-serif text-sm font-semibold">
                      {lang === 'en' ? currentHeroSlide.titleEn : currentHeroSlide.titleBn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Multi-Photo Thumbnail Strip & Navigation Controls (Desktop Bottom-Right & Mobile Bottom) */}
              <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-white/95 p-3 shadow-sm backdrop-blur-md lg:mt-0 lg:w-[370px] lg:shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#B45309] tabular-nums">
                      {copy.heroCampusTag} · {formatDigits(safeHeroIndex + 1, lang)}/
                      {formatDigits(activeHeroSlides.length, lang)}
                    </p>
                    <p className="truncate text-xs font-semibold text-[#0F172A] sm:text-sm">
                      {lang === 'en' ? currentHeroSlide.titleEn : currentHeroSlide.titleBn}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={goToPrevHeroSlide}
                      aria-label={copy.heroPrevSlideAria}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] transition-colors hover:border-[#065F46] hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextHeroSlide}
                      aria-label={copy.heroNextSlideAria}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] transition-colors hover:border-[#065F46] hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Clickable Multi-Photo Thumbnails */}
                <div className="mt-2.5 grid grid-cols-5 gap-2">
                  {activeHeroSlides.map((slide, idx) => {
                    const isSelected = idx === safeHeroIndex;
                    const slideTitle = lang === 'en' ? slide.titleEn : slide.titleBn;
                    const thumbFailed = failedHeroSlides[slide.id];
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setActiveHeroSlide(idx)}
                        aria-label={copy.heroSelectSlideAria(
                          formatDigits(idx + 1, lang),
                          slideTitle,
                        )}
                        aria-pressed={isSelected}
                        className={`group relative aspect-[16/10] overflow-hidden rounded-md border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] ${
                          isSelected
                            ? 'border-[#065F46] ring-2 ring-[#065F46]/30'
                            : 'border-[#E2E8F0] opacity-75 hover:opacity-100'
                        }`}
                      >
                        {!thumbFailed ? (
                          <img
                            src={slide.imageUrl}
                            alt={slideTitle}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedHeroSlides((prev) => ({ ...prev, [slide.id]: true }))
                            }
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-slate-100 text-[10px] font-semibold text-[#065F46]">
                            {formatDigits(idx + 1, lang)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Minimalist 4-Column Stat Bar Anchored Beneath the Hero */}
          <div className="relative z-20 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:-mt-7 lg:px-8 lg:pb-16">
            <div className="grid grid-cols-2 divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white shadow-sm sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              {activeStats.map((stat) => (
                <div key={stat.label} className="px-6 py-5 text-center sm:text-left">
                  <p className="font-serif text-2xl font-bold text-[#065F46] tabular-nums sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-[#475569]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. About & Principal's Message */}
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
                    {!libraryImgFailed && aboutCms.libraryPhotoUrl ? (
                      <img
                        src={aboutCms.libraryPhotoUrl}
                        alt={copy.aboutLibraryFallback}
                        referrerPolicy="no-referrer"
                        onError={() => setLibraryImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                        <BookOpen className="h-10 w-10 text-[#065F46]" aria-hidden="true" />
                        <p className="mt-3 text-sm font-medium text-[#0F172A]">
                          {copy.aboutLibraryFallback}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-[#E2E8F0] px-5 py-4">
                    <p className="text-xs font-medium text-[#475569]">
                      {lang === 'en' ? aboutCms.libraryCaptionEn : aboutCms.libraryCaptionBn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Principal's Message & Core Values */}
              <div className="lg:col-span-7">
                <div className="text-center">
                  <p className="text-sm font-medium text-[#B45309]">
                    {lang === 'en' ? aboutCms.eyebrowEn : aboutCms.eyebrowBn}
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                    {lang === 'en' ? aboutCms.headingEn : aboutCms.headingBn}
                  </h2>
                </div>

                <div className="mt-6 border-y border-[#E2E8F0] py-6">
                  <blockquote className="text-base leading-relaxed text-[#0F172A] sm:text-lg">
                    {lang === 'en' ? aboutCms.quoteEn : aboutCms.quoteBn}
                  </blockquote>
                  <div className="mt-5 flex items-center gap-3.5 text-sm">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC]">
                      {!muhtamimImgFailed && aboutCms.muhtamimPhotoUrl ? (
                        <img
                          src={aboutCms.muhtamimPhotoUrl}
                          alt={lang === 'en' ? aboutCms.muhtamimTitleEn : aboutCms.muhtamimTitleBn}
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
                      <p className="font-semibold text-[#065F46]">
                        {lang === 'en' ? aboutCms.muhtamimTitleEn : aboutCms.muhtamimTitleBn}
                      </p>
                      {(lang === 'en' ? aboutCms.muhtamimNameEn : aboutCms.muhtamimNameBn) && (
                        <p className="text-xs font-medium text-[#0F172A]">
                          {lang === 'en' ? aboutCms.muhtamimNameEn : aboutCms.muhtamimNameBn}
                        </p>
                      )}
                      <p className="text-xs text-[#475569] sm:text-sm">{activeBrandFull}</p>
                    </div>
                  </div>
                </div>

                {/* Core Educational Values */}
                <div className="mt-8 space-y-5">
                  {activeCoreValues.map((item) => (
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

        {/* 5. Academic Departments */}
        <section id="departments" className="scroll-mt-16 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">{copy.deptEyebrow}</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                {copy.deptHeading}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                {copy.deptDescription}
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {activeDepartments.map((dept) => (
                <article
                  key={dept.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                      <span className="font-semibold text-[#B45309] tabular-nums">
                        {copy.deptBadgePrefix} {dept.code}
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
                      onClick={() => handleSelectDepartmentAndScroll(dept.id)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#065F46] transition-colors hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                    >
                      <span>{copy.deptApplyBtn}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Interactive Notice Board */}
        <section
          id="notices"
          className="scroll-mt-16 border-y border-[#E2E8F0] bg-[#F8FAFC] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-medium text-[#B45309]">{copy.noticesEyebrow}</p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                  {copy.noticesHeading}
                </h2>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-col items-center gap-3">
                <div
                  role="tablist"
                  aria-label={copy.noticesHeading}
                  className="inline-flex flex-wrap items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1"
                >
                  {copy.noticeFilters.map((tab) => {
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

                {archivedNotices.length > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setNoticeArchiveMode('active')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                        noticeArchiveMode === 'active'
                          ? 'bg-[#065F46]/10 text-[#065F46]'
                          : 'text-[#475569] hover:text-[#0F172A]'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {lang === 'en'
                          ? `Active Notices (${formatDigits(activeNotices.length, lang)})`
                          : `চলমান নোটিশ (${formatDigits(activeNotices.length, lang)})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoticeArchiveMode('archived')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                        noticeArchiveMode === 'archived'
                          ? 'bg-[#B45309]/10 text-[#B45309]'
                          : 'text-[#475569] hover:text-[#0F172A]'
                      }`}
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {lang === 'en'
                          ? `Previous Notices (${formatDigits(archivedNotices.length, lang)})`
                          : `পূর্বের সংরক্ষিত নোটিশ (${formatDigits(archivedNotices.length, lang)})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notices Grid */}
            {filteredNotices.length > 0 ? (
              <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotices.map((notice) => (
                  <article
                    key={notice.id}
                    className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                        <span className="font-semibold text-[#065F46]">
                          {lang === 'en'
                            ? NOTICE_CATEGORY_EN[notice.category]
                            : notice.category}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="tabular-nums">{notice.date}</span>
                        {noticeArchiveMode === 'archived' && (
                          <span className="ml-auto rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-[#B45309]">
                            {lang === 'en' ? 'Archived' : 'সংরক্ষিত'}
                          </span>
                        )}
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
                        onClick={() => setSelectedNoticeId(notice.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#065F46] transition-colors hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>{copy.noticeViewDetails}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-10 rounded-xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center text-sm text-[#475569]">
                {lang === 'en'
                  ? 'No notices available in this category.'
                  : 'এই বিভাগে বর্তমানে কোনো নোটিশ নেই।'}
              </div>
            )}
          </div>
        </section>

        {/* 6.5. Photo Gallery */}
        <section id="gallery" className="scroll-mt-16 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">{copy.galleryEyebrow}</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                {copy.galleryHeading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#475569] sm:text-base">
                {copy.galleryDescription}
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
                          <span className="mt-2 text-xs text-[#475569]">
                            {lang === 'en' ? GALLERY_CATEGORY_EN[item.category] : item.category}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between border-t border-[#E2E8F0] p-4">
                      <div className="flex items-center gap-1.5 text-xs text-[#475569]">
                        <span className="font-semibold text-[#065F46]">
                          {lang === 'en' ? GALLERY_CATEGORY_EN[item.category] : item.category}
                        </span>
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

        {/* 7. Teachers & Faculty */}
        <section
          id="teachers"
          className="scroll-mt-16 border-y border-[#E2E8F0] bg-[#F8FAFC] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-[#B45309]">{copy.teachersEyebrow}</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                {copy.teachersHeading}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                {copy.teachersDescription}
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
                        onClick={() => setSelectedTeacherId(teacher.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#065F46] transition-colors hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                      >
                        <span>{copy.teacherViewProfile}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* See More / Collapse Button */}
            {activeTeachers.length > 3 && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllTeachers((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-6 py-3 text-sm font-medium text-[#0F172A] transition-colors duration-150 hover:border-[#065F46] hover:bg-[#F8FAFC] hover:text-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
                >
                  {showAllTeachers ? (
                    <>
                      <span>{copy.teachersCollapse}</span>
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>
                        {copy.teachersSeeMore(
                          formatDigits(activeTeachers.length - 3, lang),
                        )}
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
              <p className="text-sm font-medium text-[#B45309]">{copy.admissionEyebrow}</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#0F172A] sm:text-3xl">
                {copy.admissionHeading}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                {copy.admissionDescription}
              </p>
            </div>

            {/* 4-Step Horizontal Process */}
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {activeAdmissionSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6"
                >
                  <p className="font-serif text-lg font-bold text-[#B45309] tabular-nums">
                    {copy.stepPrefix} {formatDigits(item.step, lang)}
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
                    {copy.inlineFormTitle}
                  </h3>
                  <p className="mt-1 text-sm text-[#475569]">{copy.inlineFormSubtitle}</p>
                </div>

                {latestSubmission && (
                  <button
                    type="button"
                    onClick={() => setReceiptModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#065F46]/30 bg-[#065F46]/5 px-4 py-2 text-xs font-semibold text-[#065F46] transition-colors hover:bg-[#065F46]/10 whitespace-nowrap shrink-0 sm:text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>{copy.latestReceiptBtn(latestSubmission.trackingId)}</span>
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
                      {copy.labelStudentFullName} <span className="text-red-600">*</span>
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
                      placeholder={copy.placeholderStudentFullName}
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
                      {copy.labelFatherFullName} <span className="text-red-600">*</span>
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
                      placeholder={copy.placeholderFatherFullName}
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
                      {copy.labelDob} <span className="text-red-600">*</span>
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
                      {copy.labelSelectDept} <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="department"
                      name="department"
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value);
                        setClassIndex(0);
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
                      {activeDepartments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
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
                      {copy.labelSelectClass} <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="inline-className"
                      name="className"
                      value={classIndex}
                      onChange={(e) => setClassIndex(Number(e.target.value))}
                      className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                    >
                      {selectedInlineDept?.classes.map((cls, idx) => (
                        <option key={`${cls}-${idx}`} value={idx}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Residential Type */}
                  <div>
                    <span className="block text-sm font-medium text-[#0F172A]">
                      {copy.labelResidential} <span className="text-red-600">*</span>
                    </span>
                    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {RESIDENTIAL_OPTIONS.map((option) => {
                        const selected = residentialKey === option.key;
                        return (
                          <label
                            key={option.key}
                            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                              selected
                                ? 'border-[#065F46] bg-[#065F46]/5 text-[#065F46]'
                                : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="residentialType"
                              value={option.key}
                              checked={selected}
                              onChange={() => setResidentialKey(option.key)}
                              className="sr-only"
                            />
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                selected ? 'bg-[#065F46]' : 'bg-slate-300'
                              }`}
                              aria-hidden="true"
                            />
                            <span>{lang === 'en' ? option.en : option.bn}</span>
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
                      {copy.labelGuardianMobile} <span className="text-red-600">*</span>
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
                      placeholder={copy.placeholderMobile}
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
                    {copy.labelFullAddress} <span className="text-red-600">*</span>
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
                    placeholder={copy.placeholderFullAddress}
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

                {inlineSubmitError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                  >
                    {inlineSubmitError}
                  </div>
                )}

                <div className="flex flex-col items-start justify-between gap-4 border-t border-[#E2E8F0] pt-6 sm:flex-row sm:items-center">
                  <p className="text-xs leading-relaxed text-[#475569]">
                    {copy.inlineFormNote}
                  </p>
                  <button
                    type="submit"
                    disabled={inlineSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#065F46] px-7 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <span>
                      {inlineSubmitting
                        ? lang === 'en'
                          ? 'Submitting...'
                          : 'জমা হচ্ছে...'
                        : copy.inlineFormSubmit}
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Clean Minimal 4-Column Footer */}
      <footer
        id="contact"
        className="no-print scroll-mt-16 border-t border-[#E2E8F0] bg-[#F8FAFC] pt-16 pb-10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Madrasa Info */}
            <div>
              <div className="flex items-center gap-2.5">
                {siteSettings.logoUrl && !logoImgFailed && (
                  <img
                    src={siteSettings.logoUrl}
                    alt={activeBrandShort}
                    className="h-8 w-8 rounded-md border border-[#E2E8F0] bg-white object-contain p-0.5"
                  />
                )}
                <p className="font-serif text-lg font-bold text-[#0F172A]">{activeBrandFull}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#475569]">
                {lang === 'en'
                  ? siteSettings.footerDescEn || copy.footerAboutDesc
                  : siteSettings.footerDescBn || copy.footerAboutDesc}
              </p>
              <p className="mt-4 text-xs text-[#475569]">
                {lang === 'en'
                  ? siteSettings.footerRegEn || copy.footerReg
                  : siteSettings.footerRegBn || copy.footerReg}
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0F172A]">
                {copy.footerQuickLinks}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#475569]">
                {copy.navLinks.map((link) => (
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
              <h3 className="font-serif text-sm font-bold text-[#0F172A]">
                {copy.footerCampusTitle}
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-[#475569]">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <span>{activeAddress}</span>
                </li>
                <li className="flex items-center gap-2.5 tabular-nums">
                  <Phone className="h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <a href={telHref} className="hover:text-[#065F46]">
                    {activePhoneDisplay}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <a
                    href={`mailto:${activeEmail}`}
                    className="break-all hover:text-[#065F46]"
                  >
                    {activeEmail}
                  </a>
                </li>
              </ul>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(activeAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#065F46] underline-offset-4 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.footerMapLink}</span>
              </a>
            </div>

            {/* Column 4: Office Hours */}
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0F172A]">
                {copy.footerOfficeTitle}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#475569]">
                <li className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-[#0F172A]">
                      {lang === 'en'
                        ? siteSettings.officeDaysEn || copy.footerDays
                        : siteSettings.officeDaysBn || copy.footerDays}
                    </p>
                    <p className="tabular-nums">
                      {lang === 'en'
                        ? siteSettings.officeHoursEn || copy.footerHours
                        : siteSettings.officeHoursBn || copy.footerHours}
                    </p>
                  </div>
                </li>
                <li className="border-t border-[#E2E8F0] pt-2.5">
                  <p className="font-medium text-[#0F172A]">{copy.footerInterviewLabel}</p>
                  <p className="tabular-nums">
                    {lang === 'en'
                      ? siteSettings.interviewHoursEn || copy.footerInterviewHours
                      : siteSettings.interviewHoursBn || copy.footerInterviewHours}
                  </p>
                </li>
                <li className="text-xs text-[#B45309]">
                  {lang === 'en'
                    ? siteSettings.holidayNoteEn || copy.footerHoliday
                    : siteSettings.holidayNoteBn || copy.footerHoliday}
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#E2E8F0] pt-6 text-xs text-[#475569] sm:flex-row">
            <p>
              {lang === 'en'
                ? siteSettings.copyrightEn || copy.footerCopyright
                : siteSettings.copyrightBn || copy.footerCopyright}
            </p>
            <p>{copy.footerMotto}</p>
          </div>
        </div>
      </footer>

      {/* Interactive Modals */}
      <NoticeModal
        notice={selectedNotice}
        institutionLine={activeBrandFull}
        lang={lang}
        onClose={() => setSelectedNoticeId(null)}
      />

      <ReceiptModal
        submission={receiptModalOpen ? latestSubmission : null}
        departments={activeDepartments}
        brandFull={activeBrandFull}
        lang={lang}
        onClose={() => setReceiptModalOpen(false)}
        onNewApplication={handleResetForNewApplication}
      />

      <GalleryLightboxModal
        items={galleryItems}
        activeIndex={lightboxIndex}
        lang={lang}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />

      <TeacherProfileModal
        teacher={selectedTeacher}
        lang={lang}
        onClose={() => setSelectedTeacherId(null)}
      />

      <StudentAuthModal
        isOpen={authModalOpen}
        lang={lang}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleStudentAuthSuccess}
      />

      <AdmissionFormModal
        isOpen={admissionModalOpen}
        initialDepartmentId={admissionInitialDeptId}
        departments={activeDepartments}
        bnDepartments={bnDepartments}
        lang={lang}
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
