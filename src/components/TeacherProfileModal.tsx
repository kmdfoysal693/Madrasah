import { useEffect, useState } from 'react';
import { Award, BookOpen, Briefcase, GraduationCap, User, X } from 'lucide-react';
import type { TeacherProfile } from '../data/madrasaData';
import { UI_COPY, type Language } from '../data/madrasaTranslations';

interface TeacherProfileModalProps {
  teacher: TeacherProfile | null;
  lang: Language;
  onClose: () => void;
}

export function TeacherProfileModal({ teacher, lang, onClose }: TeacherProfileModalProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const copy = UI_COPY[lang];

  useEffect(() => {
    setImgFailed(false);
  }, [teacher?.id]);

  useEffect(() => {
    if (!teacher) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [teacher, onClose]);

  if (!teacher) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-modal-title"
    >
      <div
        className="relative mx-auto my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <p className="text-xs font-semibold text-[#B45309]">{copy.teacherModalHeader}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label={copy.teacherModalClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-[#E2E8F0] bg-slate-100">
                {!imgFailed ? (
                  <img
                    src={teacher.photoUrl}
                    alt={teacher.name}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
                    <User className="h-10 w-10 text-[#065F46]" aria-hidden="true" />
                    <p className="mt-2 text-xs text-[#475569]">{teacher.department}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-7">
              <p className="text-xs font-medium text-[#065F46]">{teacher.department}</p>
              <h3
                id="teacher-modal-title"
                className="mt-1 font-serif text-xl font-bold text-[#0F172A] sm:text-2xl"
              >
                {teacher.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-[#475569]">{teacher.designation}</p>

              <div className="mt-4 space-y-2.5 border-t border-[#E2E8F0] pt-4 text-sm text-[#475569]">
                <div className="flex items-start gap-2.5">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <span>{teacher.qualification}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <span>{teacher.experience}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[#E2E8F0] pt-5">
            <h4 className="flex items-center gap-2 font-serif text-sm font-bold text-[#0F172A]">
              <BookOpen className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
              <span>{copy.teacherSubjectsTitle}</span>
            </h4>
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#475569]">
              {teacher.subjects.map((subject, idx) => (
                <li key={subject} className="inline-flex items-center gap-2">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                  )}
                  <span>{subject}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h4 className="flex items-center gap-2 font-serif text-sm font-bold text-[#0F172A]">
              <Award className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
              <span>{copy.teacherBioTitle}</span>
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{teacher.bio}</p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            >
              {copy.closeBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
