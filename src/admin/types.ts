import type { SiteCmsData } from '../data/cmsTypes';
import type { Language } from '../data/madrasaTranslations';
import type { AdminDashboardConfig } from './adminConfig';

export type AdminApiRequestFn = <T>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
) => Promise<T | null>;

export interface AdminPanelBaseProps {
  cmsData: SiteCmsData;
  adminToken: string;
  lang: Language;
  saving: boolean;
  cardRadiusClass: string;
  primaryHex: string;
  apiRequest: AdminApiRequestFn;
  onCmsUpdated: (nextCms: SiteCmsData) => void;
  showToast: (type: 'success' | 'error', text: string) => void;
}

export interface CustomizePanelProps {
  config: AdminDashboardConfig;
  lang: Language;
  saving: boolean;
  cardRadiusClass: string;
  onSaveConfig: (nextConfig: AdminDashboardConfig) => Promise<void>;
  onResetConfig: () => Promise<void>;
}
