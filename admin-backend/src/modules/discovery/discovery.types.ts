import { WorkArrangement, EmploymentType, ExperienceLevel, SearchDefinitionStatus, DiscoveryReferenceStatus, RunStatus } from '@prisma/client';

export interface PlannedSearchItem {
  queryText: string;
  categorySlug: string;
  subcategory?: string;
  targetLocation?: string;
  workArrangement?: WorkArrangement;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  sourceSlug?: string;
  collectionMethod?: string;
  priority?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchPlanGenerationOptions {
  categorySlugs?: string[];
  includeRemote?: boolean;
  includeCities?: boolean;
  includeLocalTerms?: boolean;
  maxPerCategory?: number;
  targetSources?: string[];
}

export interface CoverageGapAnalysis {
  categorySlug: string;
  categoryName: string;
  activeSearchCount: number;
  totalDiscoveredCount: number;
  lastDiscoveredAt?: Date | null;
  coverageScore: number; // 0 - 100
  status: 'ADEQUATE' | 'MODERATE' | 'CRITICAL_GAP';
  suggestedQueries: string[];
}

export interface DiscoveryStats {
  totalSearches: number;
  activeSearches: number;
  pausedSearches: number;
  totalDiscovered: number;
  newJobsFound: number;
  duplicatesFound: number;
  overallDuplicateRate: number; // percentage
  categoriesCount: number;
  coveredCategoriesCount: number;
  weakCategoriesCount: number;
  pendingIntakeReferences: number;
  recentFailuresCount: number;
  coverageHealthPercentage: number;
}

export interface LinkedInIntakeInput {
  url: string;
  title?: string;
  companyName?: string;
  location?: string;
  workArrangement?: WorkArrangement;
  categorySlug?: string;
  notes?: string;
  capturedByUserId?: string;
}

export interface LinkedInIntakeResult {
  referenceId: string;
  url: string;
  urlHash: string;
  isDuplicate: boolean;
  status: DiscoveryReferenceStatus;
  message: string;
}

