import { useState, type FormEvent } from 'react';
import { Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import type { CmsDepartment, SiteCmsData } from '../../data/cmsTypes';
import { formatDigits } from '../../data/madrasaTranslations';
import type { AdminPanelBaseProps } from '../types';

export function DepartmentsPanel({
  cmsData,
  lang,
  saving,
  cardRadiusClass,
  primaryHex,
  apiRequest,
  onCmsUpdated,
  showToast,
}: AdminPanelBaseProps) {
  const isEn = lang === 'en';
  const [editingDept, setEditingDept] = useState<Partial<CmsDepartment> | null>(null);
  const [deptHighlightsBn, setDeptHighlightsBn] = useState('');
  const [deptHighlightsEn, setDeptHighlightsEn] = useState('');
  const [deptClassesBn, setDeptClassesBn] = useState('');
  const [deptClassesEn, setDeptClassesEn] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openDeptEditor = (dept?: CmsDepartment) => {
    if (dept) {
      setEditingDept({ ...dept });
      setDeptHighlightsBn(dept.highlightsBn.join('\n'));
      setDeptHighlightsEn(dept.highlightsEn.join('\n'));
      setDeptClassesBn(dept.classesBn.join('\n'));
      setDeptClassesEn(dept.classesEn.join('\n'));
    } else {
      const nextNum = String(cmsData.departments.length + 1).padStart(2, '0');
      setEditingDept({
        codeBn: formatDigits(nextNum, 'bn'),
        codeEn: nextNum,
        nameBn: '',
        nameEn: '',
        subtitleBn: '',
        subtitleEn: '',
        durationBn: '৩ বছর',
        durationEn: '3 Years',
        ageGroupBn: '৭–১২ বছর',
        ageGroupEn: 'Ages 7–12',
        descriptionBn: '',
        descriptionEn: '',
      });
      setDeptHighlightsBn('');
      setDeptHighlightsEn('');
      setDeptClassesBn('১ম বর্ষ\n২য় বর্ষ');
      setDeptClassesEn('1st Year\n2nd Year');
    }
  };

  const handleSaveDepartment = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    const payload: Partial<CmsDepartment> = {
      ...editingDept,
      highlightsBn: deptHighlightsBn
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      highlightsEn: deptHighlightsEn
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      classesBn: deptClassesBn
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      classesEn: deptClassesEn
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (editingDept.id) {
      const res = await apiRequest<{ cms: SiteCmsData }>(
        `/api/admin/departments/${editingDept.id}`,
        'PUT',
        payload,
      );
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingDept(null);
        showToast('success', isEn ? 'Department updated.' : 'শিক্ষা বিভাগ হালনাগাদ হয়েছে।');
      }
    } else {
      const res = await apiRequest<{ cms: SiteCmsData }>(
        '/api/admin/departments',
        'POST',
        payload,
      );
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingDept(null);
        showToast('success', isEn ? 'New department added.' : 'নতুন শিক্ষা বিভাগ যুক্ত হয়েছে।');
      }
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    const res = await apiRequest<{ cms: SiteCmsData }>(`/api/admin/departments/${id}`, 'DELETE');
    if (res?.cms) {
      onCmsUpdated(res.cms);
      setConfirmDeleteId(null);
      showToast('success', isEn ? 'Department deleted.' : 'শিক্ষা বিভাগ মুছে ফেলা হয়েছে।');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Academic Departments' : 'শিক্ষা বিভাগসমূহ পরিচালনা'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Add new departments or update classes/Jamats. Changes reflect in the Admission forms.'
              : 'নতুন শিক্ষা বিভাগ যোগ করুন বা বিদ্যমান বিভাগ ও শ্রেণিসমূহ পরিবর্তন করুন।'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openDeptEditor()}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Add Department' : 'নতুন বিভাগ যুক্ত করুন'}</span>
        </button>
      </div>

      {editingDept && (
        <form
          onSubmit={handleSaveDepartment}
          className={`space-y-4 ${cardRadiusClass} border border-[#CBD5E1] bg-white p-5 sm:p-6`}
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="font-serif text-base font-bold text-[#0F172A]">
              {editingDept.id
                ? isEn
                  ? 'Edit Department'
                  : 'শিক্ষা বিভাগ সম্পাদনা'
                : isEn
                  ? 'Add New Department'
                  : 'নতুন শিক্ষা বিভাগ যোগ করুন'}
            </h2>
            <button
              type="button"
              onClick={() => setEditingDept(null)}
              className="rounded p-1 text-[#475569] hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Department Name (Bengali) *' : 'বিভাগের নাম (বাংলা) *'}
              </label>
              <input
                type="text"
                required
                value={editingDept.nameBn ?? ''}
                onChange={(e) =>
                  setEditingDept((prev) => ({ ...prev, nameBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Department Name (English)' : 'বিভাগের নাম (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingDept.nameEn ?? ''}
                onChange={(e) =>
                  setEditingDept((prev) => ({ ...prev, nameEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Subtitle (Bengali)' : 'সাব-টাইটেল (বাংলা)'}
              </label>
              <input
                type="text"
                value={editingDept.subtitleBn ?? ''}
                onChange={(e) =>
                  setEditingDept((prev) => ({ ...prev, subtitleBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Subtitle (English)' : 'সাব-টাইটেল (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingDept.subtitleEn ?? ''}
                onChange={(e) =>
                  setEditingDept((prev) => ({ ...prev, subtitleEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Duration & Age (Bengali)' : 'মেয়াদ ও বয়স (বাংলা)'}
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editingDept.durationBn ?? ''}
                  onChange={(e) =>
                    setEditingDept((prev) => ({ ...prev, durationBn: e.target.value }))
                  }
                  placeholder="৩ বছর"
                  className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={editingDept.ageGroupBn ?? ''}
                  onChange={(e) =>
                    setEditingDept((prev) => ({ ...prev, ageGroupBn: e.target.value }))
                  }
                  placeholder="৭–১২ বছর"
                  className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Duration & Age (English)' : 'মেয়াদ ও বয়স (ইংরেজি)'}
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editingDept.durationEn ?? ''}
                  onChange={(e) =>
                    setEditingDept((prev) => ({ ...prev, durationEn: e.target.value }))
                  }
                  placeholder="3 Years"
                  className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={editingDept.ageGroupEn ?? ''}
                  onChange={(e) =>
                    setEditingDept((prev) => ({ ...prev, ageGroupEn: e.target.value }))
                  }
                  placeholder="Ages 7–12"
                  className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Description (Bengali)' : 'বিবরণ (বাংলা)'}
              </label>
              <textarea
                rows={2}
                value={editingDept.descriptionBn ?? ''}
                onChange={(e) =>
                  setEditingDept((prev) => ({ ...prev, descriptionBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Description (English)' : 'বিবরণ (ইংরেজি)'}
              </label>
              <textarea
                rows={2}
                value={editingDept.descriptionEn ?? ''}
                onChange={(e) =>
                  setEditingDept((prev) => ({ ...prev, descriptionEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn
                  ? 'Highlights (Bengali - one per line)'
                  : 'বৈশিষ্ট্য (বাংলা - প্রতি লাইনে ১টি)'}
              </label>
              <textarea
                rows={3}
                value={deptHighlightsBn}
                onChange={(e) => setDeptHighlightsBn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn
                  ? 'Highlights (English - one per line)'
                  : 'বৈশিষ্ট্য (ইংরেজি - প্রতি লাইনে ১টি)'}
              </label>
              <textarea
                rows={3}
                value={deptHighlightsEn}
                onChange={(e) => setDeptHighlightsEn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn
                  ? 'Classes / Jamats (Bengali - one per line)'
                  : 'ক্লাস / জামাত (বাংলা - প্রতি লাইনে ১টি)'}
              </label>
              <textarea
                rows={3}
                value={deptClassesBn}
                onChange={(e) => setDeptClassesBn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn
                  ? 'Classes / Jamats (English - one per line)'
                  : 'ক্লাস / জামাত (ইংরেজি - প্রতি লাইনে ১টি)'}
              </label>
              <textarea
                rows={3}
                value={deptClassesEn}
                onChange={(e) => setDeptClassesEn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingDept(null)}
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
              <span>{isEn ? 'Save Department' : 'বিভাগ সেভ করুন'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cmsData.departments.map((dept) => (
          <div
            key={dept.id}
            className={`flex flex-col justify-between ${cardRadiusClass} border border-[#E2E8F0] bg-white p-5`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#B45309]">
                  {isEn ? `Dept ${dept.codeEn}` : `বিভাগ ${dept.codeBn}`} ·{' '}
                  {isEn ? dept.durationEn : dept.durationBn}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openDeptEditor(dept)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:border-[#065F46]"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>{isEn ? 'Edit' : 'সম্পাদনা'}</span>
                  </button>
                  {cmsData.departments.length > 1 &&
                    (confirmDeleteId === dept.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(dept.id)}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          {isEn ? 'Confirm' : 'নিশ্চিত'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs"
                        >
                          {isEn ? 'No' : 'না'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(dept.id)}
                        aria-label={isEn ? 'Delete department' : 'বিভাগ মুছুন'}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ))}
                </div>
              </div>

              <h3 className="mt-2 font-serif text-lg font-bold text-[#0F172A]">
                {isEn ? dept.nameEn : dept.nameBn}
              </h3>
              <p className="mt-1 text-xs text-[#475569]">
                {isEn ? dept.descriptionEn : dept.descriptionBn}
              </p>
              <p className="mt-2 text-xs font-medium" style={{ color: primaryHex }}>
                <span className="font-semibold">
                  {isEn ? 'Classes:' : 'শ্রেণি/জামাত:'}
                </span>{' '}
                {(isEn ? dept.classesEn : dept.classesBn).join(' · ')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
