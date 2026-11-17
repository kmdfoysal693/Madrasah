import { useEffect } from 'react';
import { CheckCircle2, Printer, RotateCcw, X } from 'lucide-react';
import { DEPARTMENTS, type AdmissionSubmission } from '../data/madrasaData';
import {
  DEPARTMENTS_EN,
  formatDigits,
  getResidentialLabel,
  UI_COPY,
  type Language,
} from '../data/madrasaTranslations';

interface ReceiptModalProps {
  submission: AdmissionSubmission | null;
  lang: Language;
  onClose: () => void;
  onNewApplication: () => void;
}

export function ReceiptModal({
  submission,
  lang,
  onClose,
  onNewApplication,
}: ReceiptModalProps) {
  const copy = UI_COPY[lang];

  useEffect(() => {
    if (!submission) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submission, onClose]);

  if (!submission) return null;

  const formatDob = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return formatDigits(`${day}/${month}/${year}`, lang);
  };

  const deptList = lang === 'en' ? DEPARTMENTS_EN : DEPARTMENTS;
  const matchedDept = submission.departmentId
    ? deptList.find((d) => d.id === submission.departmentId)
    : undefined;
  const displayDept = matchedDept?.name ?? submission.department;
  const displayClass =
    matchedDept && typeof submission.classIndex === 'number'
      ? (matchedDept.classes[submission.classIndex] ?? submission.className)
      : submission.className;
  const displayResidential = submission.residentialKey
    ? getResidentialLabel(submission.residentialKey, lang)
    : submission.residentialType;

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div
        className="printable-area relative mx-auto my-auto w-full max-w-2xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="no-print flex items-center justify-between border-b border-[#E2E8F0] pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#065F46]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{copy.receiptSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label={copy.receiptCloseAria}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-base text-[#B45309]" style={{ fontFamily: 'var(--font-arabic)' }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>
          <h3
            id="receipt-modal-title"
            className="mt-1 font-serif text-xl font-bold text-[#0F172A] sm:text-2xl"
          >
            {copy.brandFull}
          </h3>
          <p className="mt-1 text-xs text-[#475569]">{copy.receiptSubtitle}</p>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs text-[#475569]">{copy.receiptTrackingLabel}</p>
            <p className="mt-0.5 font-mono text-lg font-bold tracking-wide text-[#065F46] tabular-nums">
              {submission.trackingId}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-[#475569]">{copy.receiptSubmittedLabel}</p>
            <p className="mt-0.5 text-sm font-medium text-[#0F172A] tabular-nums">
              {submission.submittedAt}
            </p>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-[#E2E8F0] border-y border-[#E2E8F0] text-sm">
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.studentName}</dt>
            <dd className="font-semibold text-[#0F172A] sm:col-span-2">{submission.studentName}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.fatherName}</dt>
            <dd className="font-medium text-[#0F172A] sm:col-span-2">{submission.fatherName}</dd>
          </div>
          {submission.dateOfBirth && (
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-[#475569]">{copy.receiptRows.dob}</dt>
              <dd className="font-medium text-[#0F172A] tabular-nums sm:col-span-2">
                {formatDob(submission.dateOfBirth)}
              </dd>
            </div>
          )}
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.department}</dt>
            <dd className="font-semibold text-[#065F46] sm:col-span-2">{displayDept}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.className}</dt>
            <dd className="font-semibold text-[#0F172A] sm:col-span-2">{displayClass}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.residential}</dt>
            <dd className="font-medium text-[#0F172A] sm:col-span-2">{displayResidential}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.mobile}</dt>
            <dd className="font-medium text-[#0F172A] tabular-nums sm:col-span-2">
              {formatDigits(submission.mobile, lang)}
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[#475569]">{copy.receiptRows.address}</dt>
            <dd className="text-[#0F172A] sm:col-span-2">{submission.address}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#475569]">
          <p className="font-semibold text-[#0F172A]">{copy.receiptNextStepsTitle}</p>
          <p className="mt-1">{copy.receiptNextStepsBody}</p>
        </div>

        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onNewApplication}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{copy.receiptNewAppBtn}</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>{copy.receiptPrintBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
