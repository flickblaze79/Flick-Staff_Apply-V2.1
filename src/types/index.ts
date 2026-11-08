export type UserRole = 'USER' | 'STAFF' | 'MOD' | 'ADMIN' | 'OWNER';

export type Permission = 
  | 'applications.view' | 'applications.review' | 'applications.accept' | 'applications.reject' | 'applications.delete'
  | 'reports.view' | 'reports.manage'
  | 'tasks.create' | 'tasks.manage'
  | 'members.view' | 'members.manage'
  | 'roles.view' | 'roles.manage'
  | 'settings.manage'
  | 'audit.view';

export interface RoleDefinition {
  id: string;
  name: string;
  permissions: Permission[];
  isSystemRole: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  bannerURL?: string;
  bio?: string;
  role: UserRole;
  customRoleId?: string;
  createdAt: string;
  lastSignInAt?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
  suspensionDate?: string;
  suspendedBy?: string;
  roleAssignedAt?: string;
  roleAssignedBy?: string;
  providerId?: string;
  notificationsEnabled?: boolean;
}

export type ApplicationStatus = 'Pending' | 'Under Review' | 'Accepted' | 'Rejected';
export type ApplicationQueue = 'Staff Review' | 'Mod Review' | 'Admin Review' | 'Owner Review';
export type ApplicationCategory = 'Developer Apply' | 'Staff Apply' | 'Moderator Apply' | 'Helper Apply';

export const QUESTIONS: Record<ApplicationCategory, string[]> = {
  'Developer Apply': [
    "What is your Discord username?",
    "How old are you?",
    "What is your timezone?",
    "Which country do you live in?",
    "How many years of development experience do you have?",
    "Which programming languages and technologies do you specialize in?",
    "What types of projects have you developed before?",
    "Share links to your portfolio, GitHub, or previous work.",
    "Why do you want to join the FLICK Developer Team?",
    "How much time can you dedicate each week?",
    "Are you comfortable working with a team and following project requirements?"
  ],
  'Staff Apply': [
    "What is your Discord username?",
    "How old are you?",
    "What is your timezone?",
    "Which country do you live in?",
    "Do you have any previous staff experience? If yes, explain your responsibilities.",
    "What was your previous staff role, and on which server did you work?",
    "What are your biggest strengths and weaknesses?",
    "How will you help Flick Staff Apply V2.1?",
    "Why should we choose you over other applicants?",
    "How many hours per day or week can you be active on the server?",
    "If your friend breaks a server rule, what punishment or action will you take, and why?",
    "If you see a senior staff member breaking the rules and no other senior staff are online, what will you do?",
    "If two users are fighting, how will you handle the situation?",
    "State any three server rules in your own words and explain why they are important.",
    "If a sudden raid happens and you are the only staff member online, what will you do?",
    "Is there anything else you would like to tell us?"
  ],
  'Moderator Apply': [
    "What is your Discord username?",
    "How old are you?",
    "What is your timezone?",
    "Which country do you live in?",
    "What previous moderation or community management experience do you have?",
    "How do you stay calm and impartial during intense member disputes?",
    "How many hours per day or week can you dedicate to moderation duties?",
    "How would you handle a situation involving severe rule violations or harassment?",
    "Are you comfortable conducting ticket reviews and issuing warnings/bans according to policy?",
    "Why do you want to become a Moderator for Flick?",
    "Is there anything else you would like to share with the senior management team?"
  ],
  'Helper Apply': [
    "What is your Discord username?",
    "How old are you?",
    "What is your timezone?",
    "Which country do you live in?",
    "Why do you want to become a Helper on Flick?",
    "How will you assist users with their questions or technical issues?",
    "What are your key strengths when interacting with community members?",
    "How many hours per day or week can you be active on the server?",
    "If you see a user breaking the rules, what action will you take?",
    "If two users are arguing in public chat, how will you de-escalate the situation?",
    "Are you fully familiar with our community rules and guidelines?",
    "Is there anything else you would like to tell us?"
  ]
};

export interface StaffApplication {
  id?: string;
  applicantUid: string;
  applicantName: string;
  applicantEmail: string;
  discordUsername: string;
  discordUserId?: string;
  age: string;
  timezone: string;
  availableHours?: string;
  category: ApplicationCategory;
  position: string;
  answers: Record<string, string>;
  status: ApplicationStatus;
  queue?: ApplicationQueue;
  assignedReviewerUid?: string;
  assignedReviewerName?: string;
  assignmentStatus?: 'Unassigned' | 'Assigned';
  assignedAt?: string;
  reviewerUid?: string;
  reviewerRole?: UserRole | 'SYSTEM';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  decisionAt?: string;
  autoRejected?: boolean;
  autoRejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
  seenBy?: string[] | Record<string, any>;
  viewCounts?: Record<string, number>;
}

export type ReportType = 'Basic Reports' | 'Video Reports' | 'Photo Reports' | 'Other';
export type ReportStatus = 'Open' | 'Reviewing' | 'Under Review' | 'Resolved' | 'Rejected' | 'Dismissed';

export interface UserReport {
  id?: string;
  authorUid: string;
  authorName: string;
  authorEmail: string;
  reportType: ReportType | string;
  subject: string;
  description: string;
  status: ReportStatus;
  evidenceUrl?: string; // Standard attachment (Photo)
  videoLink?: string;   // Video attachment
  contactInfo?: string;
  assignedToUid?: string;
  assignedToName?: string;
  resolvedByUid?: string;
  resolvedByName?: string;
  resolvedByRole?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  savedBy?: string[]; // Array of user UIDs who bookmarked / saved this report for later
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id?: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'application' | 'report' | 'system' | 'role';
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id?: string;
  action: string;
  actorUid: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  targetResource: string;
  targetUid?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ApplicationCooldown {
  cooldownUntil: string;
  lastDecision: 'Accepted' | 'Rejected';
  lastApplicationId: string;
  updatedAt: string;
}

export interface SystemSettings {
  applicationsOpen: boolean;
  categoryToggles: Record<ApplicationCategory, boolean>;
  announcementText: string;
  requirementsText: string;
  positions: string[];
  autoRejectHours: number;
  updatedAt: string;
  maintenanceMode: boolean;
  registrationLocked: boolean;
  publicAnnouncement: string;
  general?: {
    siteName: string;
    siteDescription: string;
    siteLogo: string;
    favicon: string;
    discordInvite: string;
    announcement: string;
    footerText: string;
    maintenanceMode: boolean;
    readOnlyMode: boolean;
    defaultTheme: 'dark' | 'light';
  };
  auth?: {
    registrationEnabled: boolean;
    googleAuthEnabled: boolean;
    emailAuthEnabled: boolean;
    newRegistrationControl: boolean;
    defaultRole: UserRole;
    emailVerificationRequired: boolean;
    sessionExpirationMinutes: number;
  };
  applications?: {
    allEnabled: boolean;
    categoryToggles: Record<ApplicationCategory, boolean>;
    cooldownDays: number;
    maxSubmissions: number;
    autoRejectHours: number;
    pendingControls: boolean;
    notificationEnabled: boolean;
  };
  reports?: {
    enabled: boolean;
    photoEnabled: boolean;
    videoEnabled: boolean;
    maxFileSizeMB: number;
    allowedFormats: string[];
    categories: string[];
    notificationEnabled: boolean;
  };
  staff?: {
    systemEnabled: boolean;
    activityTracking: boolean;
    performanceMonitoring: boolean;
    inactivityTracking: boolean;
    leaveManagement: boolean;
    notificationEnabled: boolean;
  };
  notifications?: {
    browserEnabled: boolean;
    appAlerts: boolean;
    reportAlerts: boolean;
    registrationAlerts: boolean;
    staffAlerts: boolean;
    adminAlerts: boolean;
    soundEnabled: boolean;
    discordWebhookUrl: string;
  };
  appearance?: {
    accentColor: string;
    secondaryColor: string;
    backgroundStyle: string;
    sidebarStyle: 'minimal' | 'full' | 'compact';
    dashboardStyle: 'grid' | 'list';
    announcementBanner: string;
  };
  security?: {
    ownerVerificationRequired: boolean;
    sessionMonitoring: boolean;
    failedLoginMonitoring: boolean;
    unauthorizedAccessAlerts: boolean;
  };
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Pending' | 'In Progress' | 'Testing' | 'Completed';

export interface Task {
  id: string;
  assignedByUid: string;
  assignedByName: string;
  assignedToUid: string; // 'ALL' or specific user UID
  assignedToName: string; // 'All [Role]s' or specific user name
  assignedToRole: UserRole | 'ALL';
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type PanelFeature =
  | 'Dashboard'
  | 'Applications'
  | 'Application Management'
  | 'Reports'
  | 'Users'
  | 'Staff Management'
  | 'Task Management'
  | 'Analytics'
  | 'Performance'
  | 'Notifications'
  | 'Settings'
  | 'Custom features';

export interface PanelPermissionSettings {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface AIModelConfig {
  modelId: string;
  name: string;
  enabled: boolean;
  available: boolean;
  description: string;
  requiresPaidKey?: boolean;
}

export interface PanelAIConfig {
  enabled: boolean;
  systemInstruction?: string;
  defaultModelId?: string;
  models: AIModelConfig[];
}

export const DEFAULT_AI_MODELS: AIModelConfig[] = [
  {
    modelId: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    enabled: true,
    available: true,
    description: 'High speed, multimodal analysis, applicant evaluations and summaries',
  },
  {
    modelId: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    enabled: true,
    available: true,
    description: 'Ultra-low latency triage, quick screenings and fast candidate notes',
  },
  {
    modelId: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    enabled: true,
    available: true,
    description: 'General purpose fast intelligence and questionnaire assessment',
  },
  {
    modelId: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    enabled: false,
    available: true,
    requiresPaidKey: true,
    description: 'Deep reasoning and policy compliance analysis (requires paid key)',
  },
  {
    modelId: 'gemini-3.1-flash-lite-image',
    name: 'Gemini Flash Image',
    enabled: false,
    available: true,
    description: 'Visual evidence and screenshot analysis',
  },
  {
    modelId: 'gemini-3.5-transcribe',
    name: 'Gemini Audio Transcribe',
    enabled: false,
    available: true,
    description: 'Audio incident and recorded call transcription',
  },
];

export interface CustomPanel {
  id: string;
  name: string;
  description: string;
  color: string;
  assignedRole: UserRole | string;
  features: PanelFeature[];
  emoji: string;
  iconName?: string;
  visibility?: 'role_only' | 'public' | 'hidden';
  sidebarOrder?: number;
  featurePermissions?: Record<string, PanelPermissionSettings>;
  aiConfig?: PanelAIConfig;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

