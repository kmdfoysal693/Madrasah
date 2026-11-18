import { useState, type FormEvent } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { ImagePickerField } from '../../components/ImagePickerField';
import type { CmsGalleryItem, SiteCmsData } from '../../data/cmsTypes';
import type { GalleryCategory } from '../../data/madrasaData';
import type { AdminPanelBaseProps } from '../types';

const GALLERY_CATEGORIES: GalleryCategory[] = [
  'শিক্ষা কার্যক্রম',
  'ক্যাম্পাস',
  'মসজিদ',
  'অনুষ্ঠান',
  'ল্যাব',
  'আবাসিক',
  'কুতুবখানা',
];

export function GalleryPanel({
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
  const [editingGallery, setEditingGallery] = useState<Partial<CmsGalleryItem> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openGalleryEditor = (item?: CmsGalleryItem) => {
    if (item) {
      setEditingGallery({ ...item });
    } else {
      setEditingGallery({
        titleBn: '',
        titleEn: '',
        category: 'ক্যাম্পাস',
        dateBn: 'নভেম্বর ২০২৬',
        dateEn: 'November 2026',
        imageUrl: '',
      });
    }
  };

  const handleSaveGallery = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGallery) return;
    if (editingGallery.id) {
      const res = await apiRequest<{ cms: SiteCmsData }>(
        `/api/admin/gallery/${editingGallery.id}`,
        'PUT',
        editingGallery,
      );
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingGallery(null);
        showToast('success', isEn ? 'Gallery photo updated.' : 'গ্যালারি ছবি হালনাগাদ হয়েছে।');
      }
    } else {
      const res = await apiRequest<{ cms: SiteCmsData }>(
        '/api/admin/gallery',
        'POST',
        editingGallery,
      );
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingGallery(null);
        showToast('success', isEn ? 'New photo added to gallery.' : 'গ্যালারিতে নতুন ছবি যুক্ত হয়েছে।');
      }
    }
  };

  const handleDeleteGallery = async (id: string) => {
    const res = await apiRequest<{ cms: SiteCmsData }>(`/api/admin/gallery/${id}`, 'DELETE');
    if (res?.cms) {
      onCmsUpdated(res.cms);
      setConfirmDeleteId(null);
      showToast('success', isEn ? 'Photo removed.' : 'ছবিটি গ্যালারি থেকে মুছে ফেলা হয়েছে।');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Photo Gallery Management' : 'ফটো গ্যালারি নিয়ন্ত্রণ'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Upload campus photos, edit titles, or remove images from the public gallery.'
              : 'গ্যালারিতে নতুন ছবি আপলোড করুন, শিরোনাম সম্পাদনা করুন অথবা ছবি মুছে ফেলুন।'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openGalleryEditor()}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Add Gallery Photo' : 'নতুন ছবি যুক্ত করুন'}</span>
        </button>
      </div>

      {editingGallery && (
        <form
          onSubmit={handleSaveGallery}
          className={`space-y-4 ${cardRadiusClass} border border-[#CBD5E1] bg-white p-5 sm:p-6`}
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="font-serif text-base font-bold text-[#0F172A]">
              {editingGallery.id
                ? isEn
                  ? 'Edit Gallery Photo'
                  : 'ছবি সম্পাদনা'
                : isEn
                  ? 'Add Gallery Photo'
                  : 'গ্যালারিতে নতুন ছবি যোগ করুন'}
            </h2>
            <button
              type="button"
              onClick={() => setEditingGallery(null)}
              className="rounded p-1 text-[#475569] hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ImagePickerField
            label={isEn ? 'Photo *' : 'ছবি নির্বাচন / আপলোড করুন *'}
            value={editingGallery.imageUrl ?? ''}
            onChange={(url) =>
              setEditingGallery((prev) => ({ ...prev, imageUrl: url }))
            }
            adminToken={adminToken}
            lang={lang}
            onError={(msg) => showToast('error', msg)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Title (Bengali) *' : 'ছবির শিরোনাম (বাংলা) *'}
              </label>
              <input
                type="text"
                required
                value={editingGallery.titleBn ?? ''}
                onChange={(e) =>
                  setEditingGallery((prev) => ({ ...prev, titleBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Title (English)' : 'ছবির শিরোনাম (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingGallery.titleEn ?? ''}
                onChange={(e) =>
                  setEditingGallery((prev) => ({ ...prev, titleEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Category' : 'ক্যাটাগরি'}
              </label>
              <select
                value={editingGallery.category ?? 'ক্যাম্পাস'}
                onChange={(e) =>
                  setEditingGallery((prev) => ({
                    ...prev,
                    category: e.target.value as GalleryCategory,
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
              >
                {GALLERY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Date Label (BN / EN)' : 'মাস / তারিখ'}
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editingGallery.dateBn ?? ''}
                  onChange={(e) =>
                    setEditingGallery((prev) => ({ ...prev, dateBn: e.target.value }))
                  }
                  placeholder="নভেম্বর ২০২৬"
                  className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={editingGallery.dateEn ?? ''}
                  onChange={(e) =>
                    setEditingGallery((prev) => ({ ...prev, dateEn: e.target.value }))
                  }
                  placeholder="November 2026"
                  className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingGallery(null)}
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
              <span>{isEn ? 'Save Photo' : 'ছবি সেভ করুন'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cmsData.gallery.map((item) => (
          <div
            key={item.id}
            className={`overflow-hidden ${cardRadiusClass} border border-[#E2E8F0] bg-white`}
          >
            <div className="aspect-[4/3] w-full bg-slate-100">
              <img
                src={item.imageUrl}
                alt={isEn ? item.titleEn : item.titleBn}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-3.5">
              <p className="text-[11px] font-medium text-[#B45309]">
                {item.category} · {isEn ? item.dateEn : item.dateBn}
              </p>
              <h3 className="mt-1 truncate text-sm font-semibold text-[#0F172A]">
                {isEn ? item.titleEn : item.titleBn}
              </h3>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openGalleryEditor(item)}
                  className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#065F46]"
                >
                  {isEn ? 'Edit' : 'সম্পাদনা'}
                </button>
                {confirmDeleteId === item.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteGallery(item.id)}
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
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-700"
                  >
                    {isEn ? 'Remove' : 'মুছুন'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
