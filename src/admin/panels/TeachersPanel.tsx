import { useState, type FormEvent } from 'react';
import { Plus, Save, Users, X } from 'lucide-react';
import { ImagePickerField } from '../../components/ImagePickerField';
import type { CmsTeacherProfile, SiteCmsData } from '../../data/cmsTypes';
import type { AdminPanelBaseProps } from '../types';

export function TeachersPanel({
  cmsData,
  adminToken,
  lang,
  saving,
  cardRadiusClass,
  primaryHex,
  apiRequest,
  onCmsUpdated,
  showToast,
}: AdminPanelBaseProps) {
  const isEn = lang === 'en';
  const [editingTeacher, setEditingTeacher] = useState<Partial<CmsTeacherProfile> | null>(null);
  const [teacherSubjectsBn, setTeacherSubjectsBn] = useState('');
  const [teacherSubjectsEn, setTeacherSubjectsEn] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openTeacherEditor = (teacher?: CmsTeacherProfile) => {
    if (teacher) {
      setEditingTeacher({ ...teacher });
      setTeacherSubjectsBn(teacher.subjectsBn.join(', '));
      setTeacherSubjectsEn(teacher.subjectsEn.join(', '));
    } else {
      setEditingTeacher({
        nameBn: '',
        nameEn: '',
        designationBn: '',
        designationEn: '',
        departmentBn: cmsData.departments[0]?.nameBn ?? 'কিতাব বিভাগ',
        departmentEn: cmsData.departments[0]?.nameEn ?? 'Kitab Department',
        qualificationBn: '',
        qualificationEn: '',
        experienceBn: '',
        experienceEn: '',
        bioBn: '',
        bioEn: '',
        photoUrl: '',
      });
      setTeacherSubjectsBn('');
      setTeacherSubjectsEn('');
    }
  };

  const handleSaveTeacher = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    const payload: Partial<CmsTeacherProfile> = {
      ...editingTeacher,
      subjectsBn: teacherSubjectsBn
        .split(/[,|\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      subjectsEn: teacherSubjectsEn
        .split(/[,|\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (editingTeacher.id) {
      const res = await apiRequest<{ cms: SiteCmsData }>(
        `/api/admin/teachers/${editingTeacher.id}`,
        'PUT',
        payload,
      );
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingTeacher(null);
        showToast('success', isEn ? 'Teacher profile updated.' : 'শিক্ষকের তথ্য হালনাগাদ হয়েছে।');
      }
    } else {
      const res = await apiRequest<{ cms: SiteCmsData }>('/api/admin/teachers', 'POST', payload);
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingTeacher(null);
        showToast('success', isEn ? 'New teacher added.' : 'নতুন শিক্ষক সফলভাবে যুক্ত হয়েছেন।');
      }
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    const res = await apiRequest<{ cms: SiteCmsData }>(`/api/admin/teachers/${id}`, 'DELETE');
    if (res?.cms) {
      onCmsUpdated(res.cms);
      setConfirmDeleteId(null);
      showToast('success', isEn ? 'Teacher removed.' : 'শিক্ষকের প্রোফাইল মুছে ফেলা হয়েছে।');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Faculty & Teachers Directory' : 'আমাদের শিক্ষকমণ্ডলী পরিচালনা'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Add new ustads/teachers, update qualifications, or remove profiles.'
              : 'নতুন শিক্ষক যুক্ত করুন, যোগ্যতা ও ছবি পরিবর্তন করুন অথবা প্রোফাইল মুছে ফেলুন।'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openTeacherEditor()}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Add New Teacher' : 'নতুন শিক্ষক যুক্ত করুন'}</span>
        </button>
      </div>

      {editingTeacher && (
        <form
          onSubmit={handleSaveTeacher}
          className={`space-y-4 ${cardRadiusClass} border border-[#CBD5E1] bg-white p-5 sm:p-6`}
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="font-serif text-base font-bold text-[#0F172A]">
              {editingTeacher.id
                ? isEn
                  ? 'Edit Teacher Profile'
                  : 'শিক্ষক প্রোফাইল সম্পাদনা'
                : isEn
                  ? 'Add New Teacher'
                  : 'নতুন শিক্ষক যোগ করুন'}
            </h2>
            <button
              type="button"
              onClick={() => setEditingTeacher(null)}
              className="rounded p-1 text-[#475569] hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ImagePickerField
            label={isEn ? 'Teacher Photo' : 'শিক্ষকের ছবি'}
            value={editingTeacher.photoUrl ?? ''}
            onChange={(url) =>
              setEditingTeacher((prev) => ({ ...prev, photoUrl: url }))
            }
            adminToken={adminToken}
            lang={lang}
            onError={(msg) => showToast('error', msg)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Full Name (Bengali) *' : 'শিক্ষকের নাম (বাংলা) *'}
              </label>
              <input
                type="text"
                required
                value={editingTeacher.nameBn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, nameBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Full Name (English)' : 'শিক্ষকের নাম (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingTeacher.nameEn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, nameEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Designation (Bengali) *' : 'পদবি (বাংলা) *'}
              </label>
              <input
                type="text"
                required
                value={editingTeacher.designationBn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, designationBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Designation (English)' : 'পদবি (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingTeacher.designationEn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, designationEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Department (Bengali)' : 'বিভাগ (বাংলা)'}
              </label>
              <input
                type="text"
                value={editingTeacher.departmentBn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, departmentBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Department (English)' : 'বিভাগ (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingTeacher.departmentEn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, departmentEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Qualification (Bengali)' : 'শিক্ষাগত যোগ্যতা (বাংলা)'}
              </label>
              <input
                type="text"
                value={editingTeacher.qualificationBn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    qualificationBn: e.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Experience (Bengali)' : 'অভিজ্ঞতা (বাংলা)'}
              </label>
              <input
                type="text"
                value={editingTeacher.experienceBn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, experienceBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn
                  ? 'Subjects (Bengali, comma separated)'
                  : 'পাঠদানের বিষয় (কমা দিয়ে লিখুন)'}
              </label>
              <input
                type="text"
                value={teacherSubjectsBn}
                onChange={(e) => setTeacherSubjectsBn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn
                  ? 'Subjects (English, comma separated)'
                  : 'পাঠদানের বিষয় (ইংরেজি - কমা দিয়ে)'}
              </label>
              <input
                type="text"
                value={teacherSubjectsEn}
                onChange={(e) => setTeacherSubjectsEn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Short Bio (Bengali)' : 'সংক্ষিপ্ত পরিচিতি (বাংলা)'}
              </label>
              <textarea
                rows={2}
                value={editingTeacher.bioBn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, bioBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Short Bio (English)' : 'সংক্ষিপ্ত পরিচিতি (ইংরেজি)'}
              </label>
              <textarea
                rows={2}
                value={editingTeacher.bioEn ?? ''}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({ ...prev, bioEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingTeacher(null)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#475569]"
            >
              {isEn ? 'Cancel' : 'বাতিল'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: primaryHex }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isEn ? 'Save Teacher' : 'শিক্ষক সেভ করুন'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cmsData.teachers.map((teacher) => (
          <div
            key={teacher.id}
            className={`flex flex-col justify-between ${cardRadiusClass} border border-[#E2E8F0] bg-white p-4`}
          >
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#E2E8F0] bg-slate-100">
                {teacher.photoUrl ? (
                  <img
                    src={teacher.photoUrl}
                    alt={isEn ? teacher.nameEn : teacher.nameBn}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Users className="m-auto h-full w-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-serif text-sm font-bold text-[#0F172A]">
                  {isEn ? teacher.nameEn : teacher.nameBn}
                </h3>
                <p className="text-xs font-medium" style={{ color: primaryHex }}>
                  {isEn ? teacher.designationEn : teacher.designationBn}
                </p>
                <p className="mt-0.5 text-[11px] text-[#475569]">
                  {isEn ? teacher.departmentEn : teacher.departmentBn}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => openTeacherEditor(teacher)}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#065F46]"
              >
                {isEn ? 'Edit' : 'সম্পাদনা'}
              </button>
              {confirmDeleteId === teacher.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(teacher.id)}
                    className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white"
                  >
                    {isEn ? 'Yes' : 'হ্যাঁ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs"
                  >
                    {isEn ? 'No' : 'না'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(teacher.id)}
                  className="flex-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-700"
                >
                  {isEn ? 'Remove' : 'মুছুন'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
