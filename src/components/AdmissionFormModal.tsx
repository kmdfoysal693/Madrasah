import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  DEPARTMENTS,
  RESIDENTIAL_TYPES,
  generateTrackingId,
  isValidBdMobile,
  normalizeMobileNumber,
  toBengaliDigits,
  type AdmissionSubmission,
  type ResidentialType,
} from '../data/madrasaData';

interface AdmissionFormModalProps {
  isOpen: boolean;
  initialDepartment?: string;
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
  initialDepartment,
  onClose,
  onSubmitted,
}: AdmissionFormModalProps) {
  const defaultDept = initialDepartment || DEPARTMENTS[0].name;
  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [department, setDepartment] = useState(defaultDept);
  const [className, setClassName] = useState(DEPARTMENTS[0].classes[0]);
  const [residentialType, setResidentialType] = useState<ResidentialType>('আবাসিক (বোর্ডিং)');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<ModalFormErrors>({});

  const availableClasses = useMemo(() => {
    const matched = DEPARTMENTS.find((d) => d.name === department);
    return matched ? matched.classes : DEPARTMENTS[0].classes;
  }, [department]);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    const targetDept = initialDepartment || DEPARTMENTS[0].name;
    setDepartment(targetDept);
    const matched = DEPARTMENTS.find((d) => d.name === targetDept);
    if (matched && matched.classes.length > 0) {
      setClassName(matched.classes[0]);
    }
  }, [initialDepartment, isOpen]);

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

  const handleDepartmentChange = (nextDept: string) => {
    setDepartment(nextDept);
    const matched = DEPARTMENTS.find((d) => d.name === nextDept);
    if (matched && matched.classes.length > 0) {
      setClassName(matched.classes[0]);
    }
    if (errors.department) {
      setErrors((prev) => ({ ...prev, department: undefined }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ModalFormErrors = {};

    if (!studentName.trim() || studentName.trim().length < 2) {
      nextErrors.studentName = 'অনুগ্রহ করে শিক্ষার্থীর পূর্ণ নাম লিখুন।';
    }
    if (!fatherName.trim() || fatherName.trim().length < 2) {
      nextErrors.fatherName = 'অনুগ্রহ করে পিতার পূর্ণ নাম লিখুন।';
    }
    if (!department) {
      nextErrors.department = 'বিভাগ নির্বাচন করুন।';
    }
    if (!className) {
      nextErrors.className = 'ক্লাস / জামাত নির্বাচন করুন।';
    }
    const cleanMobile = normalizeMobileNumber(mobile);
    if (!isValidBdMobile(cleanMobile)) {
      nextErrors.mobile = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: ০১৭XXXXXXXX)।';
    }
    if (!address.trim() || address.trim().length < 4) {
      nextErrors.address = 'অনুগ্রহ করে বর্তমান ঠিকানা লিখুন।';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    let timeFormatted = '';
    try {
      timeFormatted = new Intl.DateTimeFormat('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    } catch {
      timeFormatted = toBengaliDigits(new Date().toLocaleString('en-GB'));
    }

    const submission: AdmissionSubmission = {
      trackingId: generateTrackingId(),
      submittedAt: timeFormatted,
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      department,
      className,
      residentialType,
      mobile: cleanMobile,
      address: address.trim(),
    };

    setErrors({});
    setStudentName('');
    setFatherName('');
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
              শিক্ষাবর্ষ ১৪৪৮ হিজরি
            </p>
            <h2
              id="admission-popup-title"
              className="mt-2 font-serif text-2xl font-bold text-[#0F172A]"
            >
              অনলাইন ভর্তি ফরম
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label="ভর্তি ফরম বন্ধ করুন"
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
              শিক্ষার্থীর নাম <span className="text-red-600">*</span>
            </label>
            <input
              id="popup-student-name"
              type="text"
              value={studentName}
              onChange={(e) => {
                setStudentName(e.target.value);
                if (errors.studentName) setErrors((p) => ({ ...p, studentName: undefined }));
              }}
              placeholder="শিক্ষার্থীর পূর্ণ নাম লিখুন"
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
              পিতার নাম <span className="text-red-600">*</span>
            </label>
            <input
              id="popup-father-name"
              type="text"
              value={fatherName}
              onChange={(e) => {
                setFatherName(e.target.value);
                if (errors.fatherName) setErrors((p) => ({ ...p, fatherName: undefined }));
              }}
              placeholder="পিতার পূর্ণ নাম লিখুন"
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
                বিভাগ <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="popup-department"
                  value={department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-9 pl-3.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.name}>
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
                কোন ক্লাস / জামাতে ভর্তি <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="popup-class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-9 pl-3.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
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
                আবাসন ধরন <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="popup-residential"
                  value={residentialType}
                  onChange={(e) => setResidentialType(e.target.value as ResidentialType)}
                  className="w-full appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-9 pl-3.5 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
                >
                  {RESIDENTIAL_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
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
                অভিভাবকের মোবাইল নম্বর <span className="text-red-600">*</span>
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
                placeholder="০১৭XXXXXXXX"
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
              বর্তমান ঠিকানা <span className="text-red-600">*</span>
            </label>
            <input
              id="popup-address"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errors.address) setErrors((p) => ({ ...p, address: undefined }));
              }}
              placeholder="গ্রাম/মহল্লা, থানা, জেলা"
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
              আবেদন নিশ্চিত করুন
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
