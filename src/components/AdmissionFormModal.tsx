import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  DEPARTMENTS,
  generateTrackingId,
  isValidBdMobile,
  normalizeMobileNumber,
  toBengaliDigits,
  type AdmissionSubmission,
} from '../data/madrasaData';
import {
  DEPARTMENTS_EN,
  RESIDENTIAL_OPTIONS,
  UI_COPY,
  type Language,
  type ResidentialKey,
} from '../data/madrasaTranslations';

interface AdmissionFormModalProps {
  isOpen: boolean;
  initialDepartmentId?: string;
  lang: Language;
  onClose: () => void;
  onSubmitted: (submission: AdmissionSubmission) => void;
}

interface ModalFormErrors {
  studentName?: string;
  fatherName?: string;
  department?: string;
  className?: string;
  mobile?: string;
  address?: string;
}

export function AdmissionFormModal({
  isOpen,
  initialDepartmentId,
  lang,
  onClose,
  onSubmitted,
}: AdmissionFormModalProps) {
  const copy = UI_COPY[lang];
  const activeDepartments = lang === 'en' ? DEPARTMENTS_EN : DEPARTMENTS;

  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [departmentId, setDepartmentId] = useState(initialDepartmentId || DEPARTMENTS[0].id);
  const [classIndex, setClassIndex] = useState(0);
  const [residentialKey, setResidentialKey] = useState<ResidentialKey>('boarding');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<ModalFormErrors>({});

  const selectedDept = useMemo(
    () => activeDepartments.find((d) => d.id === departmentId) ?? activeDepartments[0],
    [activeDepartments, departmentId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setDepartmentId(initialDepartmentId || DEPARTMENTS[0].id);
    setClassIndex(0);
  }, [initialDepartmentId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDepartmentChange = (nextDeptId: string) => {
    setDepartmentId(nextDeptId);
    setClassIndex(0);
    if (errors.department) {
      setErrors((prev) => ({ ...prev, department: undefined }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ModalFormErrors = {};

    if (!studentName.trim() || studentName.trim().length < 2) {
      nextErrors.studentName = copy.validation.studentName;
    }
    if (!fatherName.trim() || fatherName.trim().length < 2) {
      nextErrors.fatherName = copy.validation.fatherName;
    }
    if (!departmentId) {
      nextErrors.department = copy.validation.dept;
    }
    if (!selectedDept.classes[classIndex]) {
      nextErrors.className = copy.validation.className;
    }
    const cleanMobile = normalizeMobileNumber(mobile);
    if (!isValidBdMobile(cleanMobile)) {
      nextErrors.mobile = copy.validation.mobile;
    }
    if (!address.trim() || address.trim().length < 4) {
      nextErrors.address = copy.validation.address;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    let timeFormatted = '';
    try {
      timeFormatted = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    } catch {
      timeFormatted =
        lang === 'en'
          ? new Date().toLocaleString('en-US')
          : toBengaliDigits(new Date().toLocaleString('en-GB'));
    }

    const bnDept = DEPARTMENTS.find((d) => d.id === selectedDept.id) ?? DEPARTMENTS[0];
    const resObj =
      RESIDENTIAL_OPTIONS.find((r) => r.key === residentialKey) ?? RESIDENTIAL_OPTIONS[0];

    const submission: AdmissionSubmission = {
      trackingId: generateTrackingId(),
      submittedAt: timeFormatted,
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      department: bnDept.name,
      departmentId: selectedDept.id,
      className: bnDept.classes[classIndex] ?? bnDept.classes[0],
      classIndex,
      residentialType: resObj.bn,
      residentialKey,
      mobile: cleanMobile,
      address: address.trim(),
    };

    setErrors({});
    setStudentName('');
    setFatherName('');
    setResidentialKey('boarding');
    setMobile('');
    setAddress('');
    onSubmitted(submission);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admission-popup-title"
    >
      <div
        className="relative mx-auto my-auto w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-block rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-[#B45309]">
              {copy.popupSessionBadge}
            </p>
            <h2
              id="admission-popup-title"
              className="mt-2 font-serif text-2xl font-bold text-[#0F172A]"
            >
              {copy.popupTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label={copy.popupCloseAria}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {/* Student Name */}
          <div>
            <label
              htmlFor="popup-student-name"
              className="block text-sm font-medium text-[#0F172A]"
            >
              {copy.popupStudentName} <span className="text-red-600">*</span>
            </label>
            <input
              id="popup-student-name"
              type="text"
              value={studentName}
              onChange={(e) => {
                setStudentName(e.target.value);
                if (errors.studentName) setErrors((p) => ({ ...p, studentName: undefined }));
              }}
              placeholder={copy.popupStudentPlaceholder}
              className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.studentName
                  ? 'border-red-600 focus:ring-red-600/20'
                  : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
              }`}
            />
            {errors.studentName && (
              <p className="mt-1 text-xs font-medium text-red-600">{errors.studentName}</p>
            )}
          </div>

          {/* Father Name */}
          <div>
            <label
              htmlFor="popup-father-name"
              className="block text-sm font-medium text-[#0F172A]"
            >
              {copy.popupFatherName} <span className="text-red-600">*</span>
            </label>
            <input
              id="popup-father-name"
              type="text"
              value={fatherName}
              onChange={(e) => {
                setFatherName(e.target.value);
                if (errors.fatherName) setErrors((p) => ({ ...p, fatherName: undefined }));
              }}
              placeholder={copy.popupFatherPlaceholder}
              className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.fatherName
                  ? 'border-red-600 focus:ring-red-600/20'
                  : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
              }`}
            />
            {errors.fatherName && (
              <p className="mt-1 text-xs font-medium text-red-600">{errors.fatherName}</p>
            )}
          </div>

          {/* Department & Class (2 columns) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="popup-department"
                className="block text-sm font-medium text-[#0F172A]"
              >
                {copy.popupDept} <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="popup-department"
                  value={departmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-9 pl-3.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                >
                  {activeDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="popup-class"
                className="block text-sm font-medium text-[#0F172A]"
              >
                {copy.popupClass} <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="popup-class"
                  value={classIndex}
                  onChange={(e) => setClassIndex(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-9 pl-3.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                >
                  {selectedDept.classes.map((cls, idx) => (
                    <option key={cls} value={idx}>
                      {cls}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          {/* Residential Type & Guardian Mobile */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="popup-residential"
                className="block text-sm font-medium text-[#0F172A]"
              >
                {copy.labelResidential} <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="popup-residential"
                  value={residentialKey}
                  onChange={(e) => setResidentialKey(e.target.value as ResidentialKey)}
                  className="w-full appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-9 pl-3.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                >
                  {RESIDENTIAL_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {lang === 'en' ? option.en : option.bn}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="popup-mobile"
                className="block text-sm font-medium text-[#0F172A]"
              >
                {copy.labelGuardianMobile} <span className="text-red-600">*</span>
              </label>
              <input
                id="popup-mobile"
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  if (errors.mobile) setErrors((p) => ({ ...p, mobile: undefined }));
                }}
                placeholder={copy.placeholderMobile}
                className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 tabular-nums focus:outline-none focus:ring-2 ${
                  errors.mobile
                    ? 'border-red-600 focus:ring-red-600/20'
                    : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
                }`}
              />
              {errors.mobile && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.mobile}</p>
              )}
            </div>
          </div>

          {/* Current Address */}
          <div>
            <label
              htmlFor="popup-address"
              className="block text-sm font-medium text-[#0F172A]"
            >
              {copy.popupAddress} <span className="text-red-600">*</span>
            </label>
            <input
              id="popup-address"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errors.address) setErrors((p) => ({ ...p, address: undefined }));
              }}
              placeholder={copy.popupAddressPlaceholder}
              className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.address
                  ? 'border-red-600 focus:ring-red-600/20'
                  : 'border-[#E2E8F0] focus:border-[#065F46] focus:ring-[#065F46]/15'
              }`}
            />
            {errors.address && (
              <p className="mt-1 text-xs font-medium text-red-600">{errors.address}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-xl bg-[#065F46] px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            >
              {copy.popupSubmit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
