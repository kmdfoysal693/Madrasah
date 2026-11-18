import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_ADMIN_CONFIG,
  normalizeAdminConfig,
  type AdminDashboardConfig,
} from '../admin/adminConfig';
import type {
  AboutSectionCms,
  AdmissionStatus,
  CmsDepartment,
  CmsGalleryItem,
  CmsNotice,
  CmsTeacherProfile,
  HeroSectionCms,
  NoticeStatus,
  SiteCmsData,
  SiteSettingsCms,
  StoredAdmissionRecord,
} from '../data/cmsTypes';
import { createDefaultCmsData, DEFAULT_CMS_DATA } from '../data/defaultCmsSeed';
import { db, handleFirestoreError, OperationType } from '../firebase';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function clampStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  return cleaned || `${prefix}-${Date.now()}`;
}

function timestampToIso(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function sanitizeSiteSettingsPayload(s: Partial<SiteSettingsCms>): Record<string, unknown> {
  return {
    logoUrl: clampStr(s.logoUrl, 400000),
    brandShortBn: clampStr(s.brandShortBn || DEFAULT_CMS_DATA.siteSettings.brandShortBn, 200),
    brandShortEn: clampStr(s.brandShortEn, 200),
    brandFullBn: clampStr(s.brandFullBn || DEFAULT_CMS_DATA.siteSettings.brandFullBn, 300),
    brandFullEn: clampStr(s.brandFullEn, 300),
    phoneBn: clampStr(s.phoneBn, 80),
    phoneEn: clampStr(s.phoneEn, 80),
    email: clampStr(s.email, 160),
    addressBn: clampStr(s.addressBn, 400),
    addressEn: clampStr(s.addressEn, 400),
    officeDaysBn: clampStr(s.officeDaysBn, 200),
    officeDaysEn: clampStr(s.officeDaysEn, 200),
    officeHoursBn: clampStr(s.officeHoursBn, 200),
    officeHoursEn: clampStr(s.officeHoursEn, 200),
    interviewHoursBn: clampStr(s.interviewHoursBn, 200),
    interviewHoursEn: clampStr(s.interviewHoursEn, 200),
    holidayNoteBn: clampStr(s.holidayNoteBn, 200),
    holidayNoteEn: clampStr(s.holidayNoteEn, 200),
    footerDescBn: clampStr(s.footerDescBn, 1000),
    footerDescEn: clampStr(s.footerDescEn, 1000),
    footerRegBn: clampStr(s.footerRegBn, 300),
    footerRegEn: clampStr(s.footerRegEn, 300),
    copyrightBn: clampStr(s.copyrightBn, 300),
    copyrightEn: clampStr(s.copyrightEn, 300),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeHeroSectionPayload(h: Partial<HeroSectionCms>): Record<string, unknown> {
  const slides = Array.isArray(h.slides) && h.slides.length > 0
    ? h.slides.slice(0, 12)
    : DEFAULT_CMS_DATA.heroSection.slides;
  const stats = Array.isArray(h.stats) ? h.stats.slice(0, 8) : DEFAULT_CMS_DATA.heroSection.stats;
  return {
    welcomeBn: clampStr(h.welcomeBn, 300),
    welcomeEn: clampStr(h.welcomeEn, 300),
    badgeBn: clampStr(h.badgeBn, 200),
    badgeEn: clampStr(h.badgeEn, 200),
    headlineLine1Bn: clampStr(h.headlineLine1Bn || DEFAULT_CMS_DATA.heroSection.headlineLine1Bn, 300),
    headlineLine1En: clampStr(h.headlineLine1En, 300),
    headlineLine2Bn: clampStr(h.headlineLine2Bn, 300),
    headlineLine2En: clampStr(h.headlineLine2En, 300),
    subtitleBn: clampStr(h.subtitleBn, 500),
    subtitleEn: clampStr(h.subtitleEn, 500),
    descriptionBn: clampStr(h.descriptionBn, 1200),
    descriptionEn: clampStr(h.descriptionEn, 1200),
    slides,
    stats,
    updatedAt: serverTimestamp(),
  };
}

function sanitizeAboutSectionPayload(a: Partial<AboutSectionCms>): Record<string, unknown> {
  const coreValues = Array.isArray(a.coreValues)
    ? a.coreValues.slice(0, 8)
    : DEFAULT_CMS_DATA.aboutSection.coreValues;
  return {
    eyebrowBn: clampStr(a.eyebrowBn, 200),
    eyebrowEn: clampStr(a.eyebrowEn, 200),
    headingBn: clampStr(a.headingBn || DEFAULT_CMS_DATA.aboutSection.headingBn, 300),
    headingEn: clampStr(a.headingEn, 300),
    quoteBn: clampStr(a.quoteBn, 2000),
    quoteEn: clampStr(a.quoteEn, 2000),
    muhtamimNameBn: clampStr(a.muhtamimNameBn || DEFAULT_CMS_DATA.aboutSection.muhtamimNameBn, 200),
    muhtamimNameEn: clampStr(a.muhtamimNameEn, 200),
    muhtamimTitleBn: clampStr(a.muhtamimTitleBn, 200),
    muhtamimTitleEn: clampStr(a.muhtamimTitleEn, 200),
    muhtamimPhotoUrl: clampStr(a.muhtamimPhotoUrl, 400000),
    libraryPhotoUrl: clampStr(a.libraryPhotoUrl, 400000),
    libraryCaptionBn: clampStr(a.libraryCaptionBn, 300),
    libraryCaptionEn: clampStr(a.libraryCaptionEn, 300),
    coreValues,
    updatedAt: serverTimestamp(),
  };
}

function sanitizeDepartmentPayload(d: CmsDepartment, orderIndex: number): Record<string, unknown> {
  const classesBn = Array.isArray(d.classesBn) && d.classesBn.length > 0 ? d.classesBn.slice(0, 25) : ['১ম বর্ষ'];
  const classesEn = Array.isArray(d.classesEn) && d.classesEn.length > 0 ? d.classesEn.slice(0, 25) : ['1st Year'];
  return {
    id: sanitizeId(d.id, 'dept'),
    order: orderIndex,
    codeBn: clampStr(d.codeBn, 40),
    codeEn: clampStr(d.codeEn, 40),
    nameBn: clampStr(d.nameBn || 'শিক্ষা বিভাগ', 200),
    nameEn: clampStr(d.nameEn || d.nameBn, 200),
    subtitleBn: clampStr(d.subtitleBn, 300),
    subtitleEn: clampStr(d.subtitleEn, 300),
    durationBn: clampStr(d.durationBn, 100),
    durationEn: clampStr(d.durationEn, 100),
    ageGroupBn: clampStr(d.ageGroupBn, 100),
    ageGroupEn: clampStr(d.ageGroupEn, 100),
    descriptionBn: clampStr(d.descriptionBn, 1500),
    descriptionEn: clampStr(d.descriptionEn, 1500),
    highlightsBn: Array.isArray(d.highlightsBn) ? d.highlightsBn.slice(0, 20).map(String) : [],
    highlightsEn: Array.isArray(d.highlightsEn) ? d.highlightsEn.slice(0, 20).map(String) : [],
    classesBn: classesBn.map(String),
    classesEn: classesEn.map(String),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeNoticePayload(n: CmsNotice): Record<string, unknown> {
  return stripUndefined({
    id: sanitizeId(n.id, 'notice'),
    status: n.status === 'archived' ? 'archived' : 'active',
    category: clampStr(n.category || 'সাধারণ', 60),
    dateBn: clampStr(n.dateBn, 100),
    dateEn: clampStr(n.dateEn, 100),
    hijriDateBn: clampStr(n.hijriDateBn, 100),
    hijriDateEn: clampStr(n.hijriDateEn, 100),
    refNumber: clampStr(n.refNumber, 120),
    titleBn: clampStr(n.titleBn || 'নোটিশ', 400),
    titleEn: clampStr(n.titleEn || n.titleBn, 400),
    summaryBn: clampStr(n.summaryBn, 1000),
    summaryEn: clampStr(n.summaryEn, 1000),
    fullTextBn: Array.isArray(n.fullTextBn) ? n.fullTextBn.slice(0, 40).map(String) : [],
    fullTextEn: Array.isArray(n.fullTextEn) ? n.fullTextEn.slice(0, 40).map(String) : [],
    issuedByBn: clampStr(n.issuedByBn, 300),
    issuedByEn: clampStr(n.issuedByEn, 300),
    createdAt: clampStr(n.createdAt || new Date().toISOString(), 80),
    archivedAt: n.archivedAt ? clampStr(n.archivedAt, 80) : undefined,
    updatedAt: serverTimestamp(),
  });
}

function sanitizeGalleryPayload(g: CmsGalleryItem, createdAtMs: number): Record<string, unknown> {
  return {
    id: sanitizeId(g.id, 'gal'),
    titleBn: clampStr(g.titleBn || 'ক্যাম্পাস ছবি', 300),
    titleEn: clampStr(g.titleEn || g.titleBn, 300),
    category: clampStr(g.category || 'ক্যাম্পাস', 80),
    dateBn: clampStr(g.dateBn, 80),
    dateEn: clampStr(g.dateEn, 80),
    imageUrl: clampStr(g.imageUrl, 400000),
    createdAtMs,
    updatedAt: serverTimestamp(),
  };
}

function sanitizeTeacherPayload(t: CmsTeacherProfile, orderIndex: number): Record<string, unknown> {
  return {
    id: sanitizeId(t.id, 'teacher'),
    order: orderIndex,
    nameBn: clampStr(t.nameBn || 'শিক্ষক', 200),
    nameEn: clampStr(t.nameEn || t.nameBn, 200),
    designationBn: clampStr(t.designationBn || 'উস্তাদ', 200),
    designationEn: clampStr(t.designationEn || t.designationBn, 200),
    departmentBn: clampStr(t.departmentBn, 200),
    departmentEn: clampStr(t.departmentEn, 200),
    qualificationBn: clampStr(t.qualificationBn, 300),
    qualificationEn: clampStr(t.qualificationEn, 300),
    experienceBn: clampStr(t.experienceBn, 200),
    experienceEn: clampStr(t.experienceEn, 200),
    subjectsBn: Array.isArray(t.subjectsBn) ? t.subjectsBn.slice(0, 20).map(String) : [],
    subjectsEn: Array.isArray(t.subjectsEn) ? t.subjectsEn.slice(0, 20).map(String) : [],
    bioBn: clampStr(t.bioBn, 1500),
    bioEn: clampStr(t.bioEn, 1500),
    photoUrl: clampStr(t.photoUrl, 400000),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Seeds Cloud Firestore from current CMS data on first admin connection
 * so that editing one item never leaves other collections empty.
 */
export async function seedCloudCmsIfEmpty(seedSource: SiteCmsData): Promise<boolean> {
  const path = 'cms_sections/siteSettings';
  try {
    const ref = doc(db, 'cms_sections', 'siteSettings');
    const existingSnap = await getDocFromServer(ref);
    if (existingSnap.exists()) {
      return false;
    }

    const batch = writeBatch(db);
    batch.set(ref, sanitizeSiteSettingsPayload(seedSource.siteSettings));
    batch.set(doc(db, 'cms_sections', 'heroSection'), sanitizeHeroSectionPayload(seedSource.heroSection));
    batch.set(doc(db, 'cms_sections', 'aboutSection'), sanitizeAboutSectionPayload(seedSource.aboutSection));

    seedSource.departments.forEach((d, idx) => {
      const id = sanitizeId(d.id, `dept-${idx}`);
      batch.set(doc(db, 'cms_departments', id), sanitizeDepartmentPayload({ ...d, id }, idx));
    });

    seedSource.notices.forEach((n, idx) => {
      const id = sanitizeId(n.id, `notice-${idx}`);
      batch.set(doc(db, 'cms_notices', id), sanitizeNoticePayload({ ...n, id }));
    });

    const baseMs = Date.now();
    seedSource.gallery.forEach((g, idx) => {
      const id = sanitizeId(g.id, `gal-${idx}`);
      batch.set(
        doc(db, 'cms_gallery', id),
        sanitizeGalleryPayload({ ...g, id }, baseMs - idx * 1000),
      );
    });

    seedSource.teachers.forEach((t, idx) => {
      const id = sanitizeId(t.id, `teacher-${idx}`);
      batch.set(doc(db, 'cms_teachers', id), sanitizeTeacherPayload({ ...t, id }, idx));
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCloudCmsSnapshot(): Promise<SiteCmsData | null> {
  try {
    const settingsSnap = await getDoc(doc(db, 'cms_sections', 'siteSettings'));
    if (!settingsSnap.exists()) {
      return null;
    }

    const [heroSnap, aboutSnap, deptsSnap, noticesSnap, gallerySnap, teachersSnap] =
      await Promise.all([
        getDoc(doc(db, 'cms_sections', 'heroSection')),
        getDoc(doc(db, 'cms_sections', 'aboutSection')),
        getDocs(query(collection(db, 'cms_departments'), orderBy('order', 'asc'))),
        getDocs(query(collection(db, 'cms_notices'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'cms_gallery'), orderBy('createdAtMs', 'desc'))),
        getDocs(query(collection(db, 'cms_teachers'), orderBy('order', 'asc'))),
      ]);

    const fallback = createDefaultCmsData();
    const rawSettings = settingsSnap.data();
    const rawHero = heroSnap.exists() ? heroSnap.data() : {};
    const rawAbout = aboutSnap.exists() ? aboutSnap.data() : {};

    return {
      siteSettings: { ...fallback.siteSettings, ...(rawSettings as Partial<SiteSettingsCms>) },
      heroSection: { ...fallback.heroSection, ...(rawHero as Partial<HeroSectionCms>) },
      aboutSection: { ...fallback.aboutSection, ...(rawAbout as Partial<AboutSectionCms>) },
      departments: deptsSnap.docs.map((d) => d.data() as CmsDepartment),
      notices: noticesSnap.docs.map((d) => d.data() as CmsNotice),
      gallery: gallerySnap.docs.map((d) => d.data() as CmsGalleryItem),
      teachers: teachersSnap.docs.map((d) => d.data() as CmsTeacherProfile),
      updatedAt: timestampToIso(rawSettings?.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'cms_sections');
  }
}

/**
 * Subscribes any public page (Vercel, AI Studio, mobile) to real-time Firestore CMS updates.
 * Fires immediately when Firestore changes anywhere in the world.
 */
export function subscribeToCloudCms(
  onUpdate: (cms: SiteCmsData) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const state: {
    seeded: boolean;
    siteSettings?: SiteSettingsCms;
    heroSection?: HeroSectionCms;
    aboutSection?: AboutSectionCms;
    departments?: CmsDepartment[];
    notices?: CmsNotice[];
    gallery?: CmsGalleryItem[];
    teachers?: CmsTeacherProfile[];
    updatedAt?: string;
  } = { seeded: false };

  const emitIfReady = () => {
    if (!state.seeded || !state.siteSettings) return;
    const fallback = createDefaultCmsData();
    onUpdate({
      siteSettings: { ...fallback.siteSettings, ...state.siteSettings },
      heroSection: { ...fallback.heroSection, ...(state.heroSection ?? {}) },
      aboutSection: { ...fallback.aboutSection, ...(state.aboutSection ?? {}) },
      departments: state.departments ?? fallback.departments,
      notices: state.notices ?? fallback.notices,
      gallery: state.gallery ?? fallback.gallery,
      teachers: state.teachers ?? fallback.teachers,
      updatedAt: state.updatedAt || new Date().toISOString(),
    });
  };

  const handleErr = (path: string) => (err: unknown) => {
    onError?.(err);
    try {
      handleFirestoreError(err, OperationType.GET, path);
    } catch {
      // already logged via handleFirestoreError; caller handles fallback gracefully
    }
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'cms_sections'),
      (snap) => {
        if (snap.empty) {
          state.seeded = false;
          return;
        }
        let foundSettings = false;
        let latestTs = state.updatedAt ?? '';
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.updatedAt) {
            latestTs = timestampToIso(data.updatedAt);
          }
          if (docSnap.id === 'siteSettings') {
            foundSettings = true;
            state.siteSettings = data as SiteSettingsCms;
          } else if (docSnap.id === 'heroSection') {
            state.heroSection = data as HeroSectionCms;
          } else if (docSnap.id === 'aboutSection') {
            state.aboutSection = data as AboutSectionCms;
          }
        }
        state.seeded = foundSettings;
        state.updatedAt = latestTs || new Date().toISOString();
        emitIfReady();
      },
      handleErr('cms_sections'),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'cms_departments'), orderBy('order', 'asc')),
      (snap) => {
        state.departments = snap.docs.map((d) => d.data() as CmsDepartment);
        state.updatedAt = new Date().toISOString();
        emitIfReady();
      },
      handleErr('cms_departments'),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'cms_notices'), orderBy('createdAt', 'desc')),
      (snap) => {
        state.notices = snap.docs.map((d) => d.data() as CmsNotice);
        state.updatedAt = new Date().toISOString();
        emitIfReady();
      },
      handleErr('cms_notices'),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'cms_gallery'), orderBy('createdAtMs', 'desc')),
      (snap) => {
        state.gallery = snap.docs.map((d) => d.data() as CmsGalleryItem);
        state.updatedAt = new Date().toISOString();
        emitIfReady();
      },
      handleErr('cms_gallery'),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'cms_teachers'), orderBy('order', 'asc')),
      (snap) => {
        state.teachers = snap.docs.map((d) => d.data() as CmsTeacherProfile);
        state.updatedAt = new Date().toISOString();
        emitIfReady();
      },
      handleErr('cms_teachers'),
    ),
  );

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

// ============================================================================
// CLOUD CMS WRITE HELPERS (ADMIN ONLY)
// ============================================================================

export async function cloudSaveSiteSettings(settings: Partial<SiteSettingsCms>) {
  const path = 'cms_sections/siteSettings';
  try {
    await setDoc(doc(db, 'cms_sections', 'siteSettings'), sanitizeSiteSettingsPayload(settings));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudSaveHeroSection(hero: Partial<HeroSectionCms>) {
  const path = 'cms_sections/heroSection';
  try {
    await setDoc(doc(db, 'cms_sections', 'heroSection'), sanitizeHeroSectionPayload(hero));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudSaveAboutSection(about: Partial<AboutSectionCms>) {
  const path = 'cms_sections/aboutSection';
  try {
    await setDoc(doc(db, 'cms_sections', 'aboutSection'), sanitizeAboutSectionPayload(about));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudUpsertDepartment(dept: Partial<CmsDepartment>, orderIndex: number) {
  const id = sanitizeId(dept.id || `dept-${Date.now()}`, 'dept');
  const full: CmsDepartment = {
    id,
    codeBn: dept.codeBn ?? String(orderIndex + 1).padStart(2, '0'),
    codeEn: dept.codeEn ?? String(orderIndex + 1).padStart(2, '0'),
    nameBn: dept.nameBn ?? '',
    nameEn: dept.nameEn || dept.nameBn || '',
    subtitleBn: dept.subtitleBn ?? '',
    subtitleEn: dept.subtitleEn || dept.subtitleBn || '',
    durationBn: dept.durationBn ?? '১ বছর',
    durationEn: dept.durationEn || '1 Year',
    ageGroupBn: dept.ageGroupBn ?? 'সকল বয়স',
    ageGroupEn: dept.ageGroupEn || 'All Ages',
    descriptionBn: dept.descriptionBn ?? '',
    descriptionEn: dept.descriptionEn || dept.descriptionBn || '',
    highlightsBn: dept.highlightsBn ?? [],
    highlightsEn: dept.highlightsEn?.length ? dept.highlightsEn : dept.highlightsBn ?? [],
    classesBn: dept.classesBn?.length ? dept.classesBn : ['১ম বর্ষ'],
    classesEn: dept.classesEn?.length ? dept.classesEn : dept.classesBn?.length ? dept.classesBn : ['1st Year'],
  };
  const path = `cms_departments/${id}`;
  try {
    await setDoc(doc(db, 'cms_departments', id), sanitizeDepartmentPayload(full, orderIndex));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudDeleteDepartment(id: string) {
  const safeId = sanitizeId(id, 'dept');
  const path = `cms_departments/${safeId}`;
  try {
    await deleteDoc(doc(db, 'cms_departments', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function cloudUpsertNotice(notice: Partial<CmsNotice>, currentBrandBn: string, currentBrandEn: string) {
  const id = sanitizeId(notice.id || `notice-${Date.now()}`, 'notice');
  const todayBn = new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayEn = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });

  const full: CmsNotice = {
    id,
    status: notice.status === 'archived' ? 'archived' : 'active',
    category: notice.category ?? 'সাধারণ',
    dateBn: notice.dateBn || todayBn,
    dateEn: notice.dateEn || todayEn,
    hijriDateBn: notice.hijriDateBn || 'জমাদিউস সানি ১৪৪৮ হি.',
    hijriDateEn: notice.hijriDateEn || 'Jumada al-Thani 1448 AH',
    refNumber: notice.refNumber || `স্মারক: জা.ই./২০২৬`,
    titleBn: notice.titleBn ?? '',
    titleEn: notice.titleEn || notice.titleBn || '',
    summaryBn: notice.summaryBn ?? '',
    summaryEn: notice.summaryEn || notice.summaryBn || '',
    fullTextBn: notice.fullTextBn ?? [],
    fullTextEn: notice.fullTextEn?.length ? notice.fullTextEn : notice.fullTextBn ?? [],
    issuedByBn: notice.issuedByBn || `মুহতামিম, ${currentBrandBn}`,
    issuedByEn: notice.issuedByEn || `Muhtamim, ${currentBrandEn}`,
    createdAt: notice.createdAt || new Date().toISOString(),
    archivedAt: notice.archivedAt,
  };

  const path = `cms_notices/${id}`;
  try {
    await setDoc(doc(db, 'cms_notices', id), sanitizeNoticePayload(full));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudSetNoticeStatus(notice: CmsNotice, status: NoticeStatus) {
  const safeId = sanitizeId(notice.id, 'notice');
  const path = `cms_notices/${safeId}`;
  try {
    const updated: CmsNotice = {
      ...notice,
      id: safeId,
      status,
      archivedAt: status === 'archived' ? new Date().toISOString() : undefined,
    };
    await setDoc(doc(db, 'cms_notices', safeId), sanitizeNoticePayload(updated));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudDeleteNotice(id: string) {
  const safeId = sanitizeId(id, 'notice');
  const path = `cms_notices/${safeId}`;
  try {
    await deleteDoc(doc(db, 'cms_notices', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function cloudUpsertGalleryItem(item: Partial<CmsGalleryItem>, existingCreatedAtMs?: number) {
  const id = sanitizeId(item.id || `gal-${Date.now()}`, 'gal');
  const full: CmsGalleryItem = {
    id,
    titleBn: item.titleBn ?? '',
    titleEn: item.titleEn || item.titleBn || '',
    category: item.category ?? 'ক্যাম্পাস',
    dateBn: item.dateBn || 'নভেম্বর ২০২৬',
    dateEn: item.dateEn || 'November 2026',
    imageUrl: item.imageUrl ?? '',
  };
  const path = `cms_gallery/${id}`;
  try {
    await setDoc(
      doc(db, 'cms_gallery', id),
      sanitizeGalleryPayload(full, existingCreatedAtMs ?? Date.now()),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudDeleteGalleryItem(id: string) {
  const safeId = sanitizeId(id, 'gal');
  const path = `cms_gallery/${safeId}`;
  try {
    await deleteDoc(doc(db, 'cms_gallery', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function cloudUpsertTeacher(teacher: Partial<CmsTeacherProfile>, orderIndex: number) {
  const id = sanitizeId(teacher.id || `teacher-${Date.now()}`, 'teacher');
  const full: CmsTeacherProfile = {
    id,
    nameBn: teacher.nameBn ?? '',
    nameEn: teacher.nameEn || teacher.nameBn || '',
    designationBn: teacher.designationBn ?? '',
    designationEn: teacher.designationEn || teacher.designationBn || '',
    departmentBn: teacher.departmentBn || 'সাধারণ ও দ্বীনি বিভাগ',
    departmentEn: teacher.departmentEn || teacher.departmentBn || 'Academic Department',
    qualificationBn: teacher.qualificationBn ?? '',
    qualificationEn: teacher.qualificationEn || teacher.qualificationBn || '',
    experienceBn: teacher.experienceBn ?? '',
    experienceEn: teacher.experienceEn || teacher.experienceBn || '',
    subjectsBn: teacher.subjectsBn ?? [],
    subjectsEn: teacher.subjectsEn?.length ? teacher.subjectsEn : teacher.subjectsBn ?? [],
    bioBn: teacher.bioBn ?? '',
    bioEn: teacher.bioEn || teacher.bioBn || '',
    photoUrl: teacher.photoUrl ?? '',
  };
  const path = `cms_teachers/${id}`;
  try {
    await setDoc(doc(db, 'cms_teachers', id), sanitizeTeacherPayload(full, orderIndex));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudDeleteTeacher(id: string) {
  const safeId = sanitizeId(id, 'teacher');
  const path = `cms_teachers/${safeId}`;
  try {
    await deleteDoc(doc(db, 'cms_teachers', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function cloudResetCmsDefaults(): Promise<SiteCmsData> {
  const fresh = createDefaultCmsData();
  try {
    const [deptsSnap, noticesSnap, gallerySnap, teachersSnap] = await Promise.all([
      getDocs(collection(db, 'cms_departments')),
      getDocs(collection(db, 'cms_notices')),
      getDocs(collection(db, 'cms_gallery')),
      getDocs(collection(db, 'cms_teachers')),
    ]);

    const batch = writeBatch(db);
    deptsSnap.docs.forEach((d) => batch.delete(d.ref));
    noticesSnap.docs.forEach((d) => batch.delete(d.ref));
    gallerySnap.docs.forEach((d) => batch.delete(d.ref));
    teachersSnap.docs.forEach((d) => batch.delete(d.ref));

    batch.set(doc(db, 'cms_sections', 'siteSettings'), sanitizeSiteSettingsPayload(fresh.siteSettings));
    batch.set(doc(db, 'cms_sections', 'heroSection'), sanitizeHeroSectionPayload(fresh.heroSection));
    batch.set(doc(db, 'cms_sections', 'aboutSection'), sanitizeAboutSectionPayload(fresh.aboutSection));

    fresh.departments.forEach((d, idx) => {
      const id = sanitizeId(d.id, `dept-${idx}`);
      batch.set(doc(db, 'cms_departments', id), sanitizeDepartmentPayload({ ...d, id }, idx));
    });
    fresh.notices.forEach((n, idx) => {
      const id = sanitizeId(n.id, `notice-${idx}`);
      batch.set(doc(db, 'cms_notices', id), sanitizeNoticePayload({ ...n, id }));
    });
    const baseMs = Date.now();
    fresh.gallery.forEach((g, idx) => {
      const id = sanitizeId(g.id, `gal-${idx}`);
      batch.set(
        doc(db, 'cms_gallery', id),
        sanitizeGalleryPayload({ ...g, id }, baseMs - idx * 1000),
      );
    });
    fresh.teachers.forEach((t, idx) => {
      const id = sanitizeId(t.id, `teacher-${idx}`);
      batch.set(doc(db, 'cms_teachers', id), sanitizeTeacherPayload({ ...t, id }, idx));
    });

    await batch.commit();
    return fresh;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'cms_sections');
  }
}

// ============================================================================
// ADMIN UI CONFIG IN FIRESTORE
// ============================================================================

export async function cloudGetAdminUiConfig(): Promise<AdminDashboardConfig | null> {
  const path = 'admin_ui/dashboard_config';
  try {
    const snap = await getDoc(doc(db, 'admin_ui', 'dashboard_config'));
    if (!snap.exists()) return null;
    return normalizeAdminConfig(snap.data() as Partial<AdminDashboardConfig>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function cloudSaveAdminUiConfig(config: AdminDashboardConfig): Promise<AdminDashboardConfig> {
  const path = 'admin_ui/dashboard_config';
  const normalized = normalizeAdminConfig(config);
  try {
    await setDoc(doc(db, 'admin_ui', 'dashboard_config'), {
      dashboardTitleBn: clampStr(normalized.dashboardTitleBn || DEFAULT_ADMIN_CONFIG.dashboardTitleBn, 200),
      dashboardTitleEn: clampStr(normalized.dashboardTitleEn, 200),
      welcomeTitleBn: clampStr(normalized.welcomeTitleBn, 300),
      welcomeTitleEn: clampStr(normalized.welcomeTitleEn, 300),
      welcomeSubtitleBn: clampStr(normalized.welcomeSubtitleBn, 800),
      welcomeSubtitleEn: clampStr(normalized.welcomeSubtitleEn, 800),
      theme: normalized.theme,
      customPrimaryHex: clampStr(normalized.customPrimaryHex, 20),
      cardRadius: normalized.cardRadius,
      sidebarCompact: Boolean(normalized.sidebarCompact),
      showOverviewQuickActions: Boolean(normalized.showOverviewQuickActions),
      tabOrder: normalized.tabOrder.slice(0, 20),
      hiddenTabs: normalized.hiddenTabs.slice(0, 20),
      customTabLabels: normalized.customTabLabels ?? {},
      updatedAt: serverTimestamp(),
    });
    return normalized;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cloudResetAdminUiConfig(): Promise<void> {
  const path = 'admin_ui/dashboard_config';
  try {
    await deleteDoc(doc(db, 'admin_ui', 'dashboard_config'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// ONLINE ADMISSIONS IN FIRESTORE (PUBLIC CREATE, ADMIN MANAGE)
// ============================================================================

export async function cloudSubmitAdmission(record: StoredAdmissionRecord): Promise<void> {
  const id = sanitizeId(record.id || `adm-${Date.now()}`, 'adm');
  const path = `admissions/${id}`;
  try {
    await setDoc(doc(db, 'admissions', id), {
      id,
      trackingId: clampStr(record.trackingId, 64),
      submittedAt: clampStr(record.submittedAt, 100),
      submittedAtIso: clampStr(record.submittedAtIso || new Date().toISOString(), 64),
      studentName: clampStr(record.studentName, 160),
      fatherName: clampStr(record.fatherName, 160),
      dateOfBirth: clampStr(record.dateOfBirth, 64),
      department: clampStr(record.department, 160),
      departmentId: clampStr(record.departmentId, 128),
      className: clampStr(record.className, 160),
      classIndex: typeof record.classIndex === 'number' ? record.classIndex : 0,
      residentialType: clampStr(record.residentialType, 120),
      residentialKey: record.residentialKey ?? 'boarding',
      mobile: clampStr(record.mobile, 20),
      address: clampStr(record.address, 500),
      status: 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function cloudSubscribeAdmissions(
  onUpdate: (records: StoredAdmissionRecord[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'admissions'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data();
        return {
          ...(raw as StoredAdmissionRecord),
          id: d.id,
          submittedAtIso: raw.submittedAtIso || timestampToIso(raw.createdAt),
        };
      });
      onUpdate(list);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export async function cloudUpdateAdmissionStatus(
  id: string,
  status: AdmissionStatus,
  adminNote: string,
): Promise<void> {
  const safeId = sanitizeId(id, 'adm');
  const path = `admissions/${safeId}`;
  try {
    await updateDoc(doc(db, 'admissions', safeId), {
      status,
      adminNote: clampStr(adminNote, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudDeleteAdmission(id: string): Promise<void> {
  const safeId = sanitizeId(id, 'adm');
  const path = `admissions/${safeId}`;
  try {
    await deleteDoc(doc(db, 'admissions', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
