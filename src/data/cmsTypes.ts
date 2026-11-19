import type { GalleryCategory, NoticeCategory } from './madrasaData';
import type { HeroSlide, ResidentialKey } from './madrasaTranslations';

export interface SiteSettingsCms {
  logoUrl: string;
  brandShortBn: string;
  brandShortEn: string;
  brandFullBn: string;
  brandFullEn: string;
  phoneBn: string;
  phoneEn: string;
  email: string;
  addressBn: string;
  addressEn: string;
  officeDaysBn: string;
  officeDaysEn: string;
  officeHoursBn: string;
  officeHoursEn: string;
  interviewHoursBn: string;
  interviewHoursEn: string;
  holidayNoteBn: string;
  holidayNoteEn: string;
  footerDescBn: string;
  footerDescEn: string;
  footerRegBn: string;
  footerRegEn: string;
  copyrightBn: string;
  copyrightEn: string;
}

export interface StatItemCms {
  valueBn: string;
  valueEn: string;
  labelBn: string;
  labelEn: string;
}

export interface HeroSectionCms {
  welcomeBn: string;
  welcomeEn: string;
  badgeBn: string;
  badgeEn: string;
  headlineLine1Bn: string;
  headlineLine1En: string;
  headlineLine2Bn: string;
  headlineLine2En: string;
  subtitleBn: string;
  subtitleEn: string;
  descriptionBn: string;
  descriptionEn: string;
  slides: HeroSlide[];
  stats: StatItemCms[];
}

export interface CoreValueCms {
  numberBn: string;
  numberEn: string;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
}

export interface AboutSectionCms {
  eyebrowBn: string;
  eyebrowEn: string;
  headingBn: string;
  headingEn: string;
  quoteBn: string;
  quoteEn: string;
  muhtamimNameBn: string;
  muhtamimNameEn: string;
  muhtamimTitleBn: string;
  muhtamimTitleEn: string;
  muhtamimPhotoUrl: string;
  libraryPhotoUrl: string;
  libraryCaptionBn: string;
  libraryCaptionEn: string;
  coreValues: CoreValueCms[];
}

export interface CmsDepartment {
  id: string;
  codeBn: string;
  codeEn: string;
  nameBn: string;
  nameEn: string;
  subtitleBn: string;
  subtitleEn: string;
  durationBn: string;
  durationEn: string;
  ageGroupBn: string;
  ageGroupEn: string;
  descriptionBn: string;
  descriptionEn: string;
  highlightsBn: string[];
  highlightsEn: string[];
  classesBn: string[];
  classesEn: string[];
}

export type NoticeStatus = 'active' | 'archived';

export interface CmsNotice {
  id: string;
  status: NoticeStatus;
  category: NoticeCategory;
  dateBn: string;
  dateEn: string;
  hijriDateBn: string;
  hijriDateEn: string;
  refNumber: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  fullTextBn: string[];
  fullTextEn: string[];
  issuedByBn: string;
  issuedByEn: string;
  createdAt: string;
  archivedAt?: string;
}

export interface CmsGalleryItem {
  id: string;
  titleBn: string;
  titleEn: string;
  category: GalleryCategory;
  dateBn: string;
  dateEn: string;
  imageUrl: string;
}

export interface CmsTeacherProfile {
  id: string;
  nameBn: string;
  nameEn: string;
  designationBn: string;
  designationEn: string;
  departmentBn: string;
  departmentEn: string;
  qualificationBn: string;
  qualificationEn: string;
  experienceBn: string;
  experienceEn: string;
  subjectsBn: string[];
  subjectsEn: string[];
  bioBn: string;
  bioEn: string;
  photoUrl: string;
}

export interface SiteCmsData {
  siteSettings: SiteSettingsCms;
  heroSection: HeroSectionCms;
  aboutSection: AboutSectionCms;
  departments: CmsDepartment[];
  notices: CmsNotice[];
  gallery: CmsGalleryItem[];
  teachers: CmsTeacherProfile[];
  updatedAt: string;
}

export type AdmissionStatus = 'pending' | 'interview' | 'approved' | 'rejected';

export interface StoredAdmissionRecord {
  id: string;
  trackingId: string;
  submittedAt: string;
  submittedAtIso: string;
  studentName: string;
  fatherName: string;
  dateOfBirth: string;
  department: string;
  departmentId: string;
  className: string;
  classIndex: number;
  residentialType: string;
  residentialKey: ResidentialKey;
  mobile: string;
  email?: string;
  address: string;
  status: AdmissionStatus;
  adminNote: string;
}
