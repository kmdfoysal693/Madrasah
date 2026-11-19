import type { SiteCmsData } from './cmsTypes';
import {
  CORE_VALUES,
  DEPARTMENTS,
  INITIAL_GALLERY_ITEMS,
  NOTICES,
  STATS,
  TEACHERS,
} from './madrasaData';
import {
  CORE_VALUES_EN,
  DEPARTMENTS_EN,
  GALLERY_ITEMS_EN,
  HERO_SLIDES,
  NOTICES_EN,
  STATS_EN,
  TEACHERS_EN,
  UI_COPY,
} from './madrasaTranslations';

export function createDefaultCmsData(): SiteCmsData {
  const bn = UI_COPY.bn;
  const en = UI_COPY.en;

  return {
    siteSettings: {
      logoUrl: '',
      brandShortBn: bn.brandShort,
      brandShortEn: en.brandShort,
      brandFullBn: bn.brandFull,
      brandFullEn: en.brandFull,
      phoneBn: bn.phoneDisplay,
      phoneEn: en.phoneDisplay,
      email: 'info@darussalam-madrasa.edu.bd',
      addressBn: bn.footerAddress,
      addressEn: en.footerAddress,
      officeDaysBn: bn.footerDays,
      officeDaysEn: en.footerDays,
      officeHoursBn: bn.footerHours,
      officeHoursEn: en.footerHours,
      interviewHoursBn: bn.footerInterviewHours,
      interviewHoursEn: en.footerInterviewHours,
      holidayNoteBn: bn.footerHoliday,
      holidayNoteEn: en.footerHoliday,
      footerDescBn: bn.footerAboutDesc,
      footerDescEn: en.footerAboutDesc,
      footerRegBn: bn.footerReg,
      footerRegEn: en.footerReg,
      copyrightBn: bn.footerCopyright,
      copyrightEn: en.footerCopyright,
    },
    heroSection: {
      welcomeBn: bn.heroWelcome,
      welcomeEn: en.heroWelcome,
      badgeBn: bn.heroBadge,
      badgeEn: en.heroBadge,
      headlineLine1Bn: bn.heroHeadlineLine1,
      headlineLine1En: en.heroHeadlineLine1,
      headlineLine2Bn: bn.heroHeadlineLine2,
      headlineLine2En: en.heroHeadlineLine2,
      subtitleBn: bn.heroSubtitle,
      subtitleEn: en.heroSubtitle,
      descriptionBn: bn.heroDescription,
      descriptionEn: en.heroDescription,
      slides: HERO_SLIDES.map((s) => ({ ...s })),
      stats: STATS.map((stat, idx) => ({
        valueBn: stat.value,
        valueEn: STATS_EN[idx]?.value ?? stat.value,
        labelBn: stat.label,
        labelEn: STATS_EN[idx]?.label ?? stat.label,
      })),
    },
    aboutSection: {
      eyebrowBn: bn.aboutEyebrow,
      eyebrowEn: en.aboutEyebrow,
      headingBn: bn.aboutHeading,
      headingEn: en.aboutHeading,
      quoteBn: bn.aboutQuote,
      quoteEn: en.aboutQuote,
      muhtamimNameBn: TEACHERS[0]?.name ?? 'এইচ এম আব্দুর রহমান খাঁন',
      muhtamimNameEn: TEACHERS_EN[0]?.name ?? 'H. M. Abdur Rahman Khan',
      muhtamimTitleBn: bn.aboutMuhtamimTitle,
      muhtamimTitleEn: en.aboutMuhtamimTitle,
      muhtamimPhotoUrl: '/assets/aistudio/beb6c739-6282-4e3a-b0eb-f53f4e608df7_aad8bb44.jfif',
      libraryPhotoUrl: '/src/assets/images/madrasa_library_heritage_1794935619165.jpg',
      libraryCaptionBn: bn.aboutLibraryCaption,
      libraryCaptionEn: en.aboutLibraryCaption,
      coreValues: CORE_VALUES.map((cv, idx) => ({
        numberBn: cv.number,
        numberEn: CORE_VALUES_EN[idx]?.number ?? cv.number,
        titleBn: cv.title,
        titleEn: CORE_VALUES_EN[idx]?.title ?? cv.title,
        descriptionBn: cv.description,
        descriptionEn: CORE_VALUES_EN[idx]?.description ?? cv.description,
      })),
    },
    departments: DEPARTMENTS.map((dept, idx) => {
      const deptEn = DEPARTMENTS_EN[idx];
      return {
        id: dept.id,
        codeBn: dept.code,
        codeEn: deptEn?.code ?? dept.code,
        nameBn: dept.name,
        nameEn: deptEn?.name ?? dept.name,
        subtitleBn: dept.subtitle,
        subtitleEn: deptEn?.subtitle ?? dept.subtitle,
        durationBn: dept.duration,
        durationEn: deptEn?.duration ?? dept.duration,
        ageGroupBn: dept.ageGroup,
        ageGroupEn: deptEn?.ageGroup ?? dept.ageGroup,
        descriptionBn: dept.description,
        descriptionEn: deptEn?.description ?? dept.description,
        highlightsBn: [...dept.highlights],
        highlightsEn: [...(deptEn?.highlights ?? dept.highlights)],
        classesBn: [...dept.classes],
        classesEn: [...(deptEn?.classes ?? dept.classes)],
      };
    }),
    notices: NOTICES.map((notice, idx) => {
      const noticeEn = NOTICES_EN.find((n) => n.id === notice.id) ?? NOTICES_EN[idx];
      return {
        id: notice.id,
        status: 'active',
        category: notice.category,
        dateBn: notice.date,
        dateEn: noticeEn?.date ?? notice.date,
        hijriDateBn: notice.hijriDate,
        hijriDateEn: noticeEn?.hijriDate ?? notice.hijriDate,
        refNumber: notice.refNumber,
        titleBn: notice.title,
        titleEn: noticeEn?.title ?? notice.title,
        summaryBn: notice.summary,
        summaryEn: noticeEn?.summary ?? notice.summary,
        fullTextBn: [...notice.fullText],
        fullTextEn: [...(noticeEn?.fullText ?? notice.fullText)],
        issuedByBn: notice.issuedBy,
        issuedByEn: noticeEn?.issuedBy ?? notice.issuedBy,
        createdAt: new Date(Date.now() - idx * 86400000 * 3).toISOString(),
      };
    }),
    gallery: INITIAL_GALLERY_ITEMS.map((item, idx) => {
      const itemEn = GALLERY_ITEMS_EN.find((g) => g.id === item.id) ?? GALLERY_ITEMS_EN[idx];
      return {
        id: item.id,
        titleBn: item.title,
        titleEn: itemEn?.title ?? item.title,
        category: item.category,
        dateBn: item.date,
        dateEn: itemEn?.date ?? item.date,
        imageUrl: item.imageUrl,
      };
    }),
    teachers: TEACHERS.map((teacher, idx) => {
      const teacherEn = TEACHERS_EN.find((t) => t.id === teacher.id) ?? TEACHERS_EN[idx];
      return {
        id: teacher.id,
        nameBn: teacher.name,
        nameEn: teacherEn?.name ?? teacher.name,
        designationBn: teacher.designation,
        designationEn: teacherEn?.designation ?? teacher.designation,
        departmentBn: teacher.department,
        departmentEn: teacherEn?.department ?? teacher.department,
        qualificationBn: teacher.qualification,
        qualificationEn: teacherEn?.qualification ?? teacher.qualification,
        experienceBn: teacher.experience,
        experienceEn: teacherEn?.experience ?? teacher.experience,
        subjectsBn: [...teacher.subjects],
        subjectsEn: [...(teacherEn?.subjects ?? teacher.subjects)],
        bioBn: teacher.bio,
        bioEn: teacherEn?.bio ?? teacher.bio,
        photoUrl: teacher.photoUrl,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export const DEFAULT_CMS_DATA: SiteCmsData = createDefaultCmsData();
