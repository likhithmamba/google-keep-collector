export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short';
  question: string;
  options?: string[];
  correctAnswer: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  videoIds: string[];
  createdAt: string;
}

export interface Bookmark {
  id: string;
  timestamp: string;
  note: string;
  createdAt: string;
}

export interface VideoItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
  summary: string;
  category: string;
  rating: number;
  ratingJustification: string;
  takeaways: string[];
  createdAt: string;
  isPinned?: boolean;
  keepNoteColor?: string;
  watchedStatus?: 'To Watch' | 'Watching' | 'Done';
  studyNotes?: string;
  extractedLinks?: string[];
  actualPurpose?: string;
  debunkedClickbait?: string;
  conceptualComplexity?: string;
  interdisciplinaryField?: string;
  conceptTags?: string[];
  leitnerBox?: number;
  nextReviewDate?: string;
  lastReviewedDate?: string;
  lastWatchedDate?: string;
  bookmarks?: Bookmark[];
  transcript?: {
    highlightsSummary: string;
    isVerified?: boolean;
    segments: Array<{
      timestamp: string;
      speaker: string;
      title: string;
      text: string;
      isHighlight: boolean;
      highlightReason: string;
    }>;
  };
  projectId?: string;
  glossary?: GlossaryEntry[];
  quiz?: QuizQuestion[];
}

export interface KeepNote {
  id: string;
  title: string;
  content: string;
  color: string;
  videoId?: string;
  pinned: boolean;
  updatedAt: string;
}

export interface LinkedAccount {
  email: string;
  displayName: string;
  photoURL: string;
  accessToken: string;
  linkedAt: string;
}

export type CategoryType = 
  | 'AI & Data Science'
  | 'Technology & Development'
  | 'Productivity & Design'
  | 'Business & Finance'
  | 'Science & Education'
  | 'Entertainment'
  | 'Lifestyle & Health';

export interface AppSettings {
  openRouterApiKey: string;
  customGeminiApiKey: string;
  useOpenRouter: boolean;
  openRouterModel: string;
  googleClientId: string;
  settingsPassword?: string;
  isSettingsLocked?: boolean;
  encryptLocalStorage?: boolean;
  categoryAccountMap?: Record<string, string>;
}
