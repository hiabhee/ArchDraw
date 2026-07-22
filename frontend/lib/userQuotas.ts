export interface GuestQuotas {
  tier: 'guest';
  aiGenerationsPerHour: number;
  maxCanvases: number;
  maxNodesPerCanvas: number;
  allowedExportFormats: string[];
  svgExport: boolean;
  allowSharing: boolean;
  allowAdvancedTemplates: boolean;
  allowedBasicTemplates: string[];
  allowTutorialProgress: boolean;
  autoSave: boolean;
  canDuplicateCanvas: boolean;
  watermarkExports: boolean;
  maxVersions: number;
  allowEditShare: boolean;
  allowDashboard: boolean;
  allowCollaboration: boolean;
}

export interface AuthenticatedQuotas {
  tier: 'authenticated';
  aiGenerationsPerDay: number;
  maxCanvases: number;
  maxNodesPerCanvas: number;
  allowedExportFormats: string[];
  svgExport: boolean;
  allowSharing: boolean;
  allowAdvancedTemplates: boolean;
  allowedBasicTemplates: string[];
  allowTutorialProgress: boolean;
  autoSave: boolean;
  canDuplicateCanvas: boolean;
  watermarkExports: boolean;
  maxVersions: number;
  allowEditShare: boolean;
  allowDashboard: boolean;
  allowCollaboration: boolean;
  shareExpiryDays: number;
}

export type UserQuotas = GuestQuotas | AuthenticatedQuotas;

export const USER_QUOTAS: Record<string, UserQuotas> = {
  guest: {
    tier: 'guest',
    aiGenerationsPerHour: 3,
    maxCanvases: 1,
    maxNodesPerCanvas: 25,
    allowedExportFormats: ['json', 'png'],
    svgExport: false,
    allowSharing: false,
    allowAdvancedTemplates: false,
    allowedBasicTemplates: ['archdraw_self', 'chatgpt', 'video_streaming', 'rideshare', 'food_delivery'],
    allowTutorialProgress: false,
    autoSave: false,
    canDuplicateCanvas: false,
    watermarkExports: true,
    maxVersions: 0,
    allowEditShare: false,
    allowDashboard: false,
    allowCollaboration: false,
  },
  authenticated: {
    tier: 'authenticated',
    aiGenerationsPerDay: 10,
    maxCanvases: 5,
    maxNodesPerCanvas: 50,
    allowedExportFormats: ['json', 'png', 'svg'],
    svgExport: true,
    allowSharing: true,
    allowAdvancedTemplates: true,
    allowedBasicTemplates: [],
    allowTutorialProgress: true,
    autoSave: true,
    canDuplicateCanvas: true,
    watermarkExports: false,
    maxVersions: 3,
    allowEditShare: false,
    allowDashboard: true,
    allowCollaboration: true,
    shareExpiryDays: 7,
  },
};

export type UserTier = 'guest' | 'authenticated';

export function getUserTier(userId: string | null | undefined): UserTier {
  return !userId || userId === 'guest' ? 'guest' : 'authenticated';
}

export function getUserQuotas(userTier: UserTier): UserQuotas {
  return USER_QUOTAS[userTier];
}

export function getGuestQuotas(): GuestQuotas {
  return USER_QUOTAS.guest as GuestQuotas;
}

export function getAuthenticatedQuotas(): AuthenticatedQuotas {
  return USER_QUOTAS.authenticated as AuthenticatedQuotas;
}

export function canAccessFeature(
  userTier: UserTier,
  feature: 'share' | 'svgExport' | 'tutorialProgress' | 'autoSave' | 'duplicate' | 'dashboard' | 'collaboration' | 'editShare'
): boolean {
  const quotas = getUserQuotas(userTier);
  switch (feature) {
    case 'share':
      return quotas.allowSharing;
    case 'svgExport':
      return quotas.svgExport;
    case 'tutorialProgress':
      return quotas.allowTutorialProgress;
    case 'autoSave':
      return quotas.autoSave;
    case 'duplicate':
      return quotas.canDuplicateCanvas;
    case 'dashboard':
      return quotas.allowDashboard;
    case 'collaboration':
      return quotas.allowCollaboration;
    case 'editShare':
      return quotas.allowEditShare;
    default:
      return false;
  }
}

export function isTemplateAllowed(userTier: UserTier, templateId: string): boolean {
  const quotas = getUserQuotas(userTier);
  if (quotas.allowAdvancedTemplates) return true;
  return quotas.allowedBasicTemplates.includes(templateId);
}

export function isExportFormatAllowed(userTier: UserTier, format: string): boolean {
  const quotas = getUserQuotas(userTier);
  return quotas.allowedExportFormats.includes(format);
}

export function shouldWatermark(userTier: UserTier, format: string): boolean {
  return userTier === 'guest' && format.startsWith('png');
}
