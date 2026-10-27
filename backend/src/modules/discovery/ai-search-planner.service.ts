import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import {
  PROFESSIONAL_TAXONOMY,
  ETHIOPIAN_CITIES,
  INTERNATIONAL_REMOTE_VARIANTS,
  CategoryTaxonomy,
} from './taxonomy-data';
import {
  PlannedSearchItem,
  SearchPlanGenerationOptions,
  CoverageGapAnalysis,
} from './discovery.types';
import { WorkArrangement, EmploymentType, ExperienceLevel } from '@prisma/client';

export function computeSearchIdentity(
  categorySlug: string,
  queryText: string,
  location?: string | null,
  workArrangement?: string | null
): string {
  const normCat = (categorySlug || '').trim().toLowerCase();
  const normQuery = (queryText || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u1200-\u137F]/g, ' ') // Preserve English & Ethiopic Unicode characters
    .replace(/\s+/g, ' ')
    .trim();
  const normLoc = (location || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normArr = (workArrangement || 'ANY').trim().toUpperCase();

  const rawIdentity = `${normCat}::${normQuery}::${normLoc}::${normArr}`;
  return crypto.createHash('sha256').update(rawIdentity).digest('hex');
}

export class AISearchPlannerService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.apiKey = options?.apiKey || env.GEMINI_API_KEY || '';
    this.model = options?.model || env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  }

  /**
   * Deterministically deduplicate a list of planned searches by identity
   */
  deduplicateSearches(searches: PlannedSearchItem[]): PlannedSearchItem[] {
    const seen = new Set<string>();
    const unique: PlannedSearchItem[] = [];

    for (const item of searches) {
      const identity = computeSearchIdentity(
        item.categorySlug,
        item.queryText,
        item.targetLocation,
        item.workArrangement
      );
      if (!seen.has(identity)) {
        seen.add(identity);
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * Generate an extensive, verified search plan across all or selected professional categories
   */
  async generateSearchPlan(options: SearchPlanGenerationOptions = {}): Promise<PlannedSearchItem[]> {
    const targetCategories = (options.categorySlugs && options.categorySlugs.length > 0)
      ? options.categorySlugs
      : Object.keys(PROFESSIONAL_TAXONOMY);

    const maxPerCat = options.maxPerCategory || 8;
    const includeRemote = options.includeRemote ?? true;
    const includeCities = options.includeCities ?? true;
    const includeLocal = options.includeLocalTerms ?? true;

    logger.info(
      `[AISearchPlanner] Generating discovery search plan for ${targetCategories.length} categories ` +
      `(maxPerCategory=${maxPerCat}, includeRemote=${includeRemote}, includeCities=${includeCities})`
    );

    const plannedSearches: PlannedSearchItem[] = [];

    for (const catSlug of targetCategories) {
      const taxonomy = PROFESSIONAL_TAXONOMY[catSlug];
      if (!taxonomy) {
        logger.warn(`[AISearchPlanner] Unknown category slug '${catSlug}', skipping.`);
        continue;
      }

      let categorySearches: PlannedSearchItem[] = [];

      // Attempt AI expansion if Gemini credentials are configured
      if (this.apiKey) {
        try {
          const aiGenerated = await this.queryGeminiForCategory(taxonomy, {
            maxQueries: maxPerCat,
            includeRemote,
            includeCities,
            includeLocal,
          });
          if (aiGenerated && aiGenerated.length > 0) {
            categorySearches.push(...aiGenerated);
          }
        } catch (err: any) {
          logger.warn(
            `[AISearchPlanner] Gemini query generation failed for '${catSlug}' (${err.message}); ` +
            `falling back to deterministic taxonomy.`
          );
        }
      }

      // Merge / fallback with deterministic taxonomy to guarantee robust coverage
      const deterministicSearches = this.buildDeterministicSearches(taxonomy, {
        maxQueries: maxPerCat,
        includeRemote,
        includeCities,
        includeLocal,
      });

      categorySearches.push(...deterministicSearches);

      // Deduplicate and enforce max limit per category
      const uniqueCategorySearches = this.deduplicateSearches(categorySearches).slice(0, maxPerCat);
      plannedSearches.push(...uniqueCategorySearches);
    }

    const finalPlan = this.deduplicateSearches(plannedSearches);
    logger.info(`[AISearchPlanner] Generated ${finalPlan.length} total deduplicated searches.`);
    return finalPlan;
  }

  /**
   * Build deterministic searches using the rich taxonomy
   */
  buildDeterministicSearches(
    taxonomy: CategoryTaxonomy,
    options: {
      maxQueries: number;
      includeRemote: boolean;
      includeCities: boolean;
      includeLocal: boolean;
    }
  ): PlannedSearchItem[] {
    const results: PlannedSearchItem[] = [];

    // 1. Core profession broad query (Nationwide Ethiopia)
    results.push({
      queryText: `${taxonomy.name} Jobs Ethiopia`,
      categorySlug: taxonomy.slug,
      subcategory: taxonomy.subcategories[0],
      targetLocation: 'Ethiopia',
      workArrangement: WorkArrangement.ON_SITE,
      employmentType: EmploymentType.FULL_TIME,
      priority: 8,
      tags: ['broad', 'nationwide', taxonomy.slug],
      metadata: {
        suggestedSources: ['all', 'afriwork', 'hahujobs', 'ethiojobs', 'geezjobs'],
      },
    });

    // 2. International Remote query if enabled
    if (options.includeRemote) {
      results.push({
        queryText: `Remote ${taxonomy.titles[0]} Worldwide or Africa`,
        categorySlug: taxonomy.slug,
        subcategory: taxonomy.subcategories[0],
        targetLocation: 'Worldwide Remote',
        workArrangement: WorkArrangement.REMOTE,
        priority: 7,
        tags: ['international_remote', 'remote_ethiopia', taxonomy.slug],
        metadata: { isInternationalRemote: true },
      });
    }

    // 3. Primary job title in Addis Ababa
    results.push({
      queryText: `${taxonomy.titles[0]} Addis Ababa`,
      categorySlug: taxonomy.slug,
      subcategory: taxonomy.subcategories[0],
      targetLocation: 'Addis Ababa',
      workArrangement: WorkArrangement.ON_SITE,
      employmentType: EmploymentType.FULL_TIME,
      experienceLevel: ExperienceLevel.MID,
      priority: 7,
      tags: ['city', 'primary_title', taxonomy.slug],
    });

    // 4. Local Amharic language query if enabled
    if (options.includeLocal && taxonomy.localTerms && taxonomy.localTerms.length > 0) {
      const topLocal = taxonomy.localTerms[0];
      results.push({
        queryText: `${topLocal} ስራ ማስታወቂያ`,
        categorySlug: taxonomy.slug,
        subcategory: taxonomy.subcategories[0],
        targetLocation: 'Addis Ababa',
        workArrangement: WorkArrangement.ON_SITE,
        priority: 6,
        tags: ['local_amharic', taxonomy.slug],
        metadata: { localTerm: topLocal },
      });
    }

    // 5. Secondary Ethiopian city search
    if (options.includeCities && ETHIOPIAN_CITIES.length > 1) {
      const regionalCity = ETHIOPIAN_CITIES[1 + (results.length % (ETHIOPIAN_CITIES.length - 1))];
      results.push({
        queryText: `${taxonomy.titles[1] || taxonomy.titles[0]} ${regionalCity}`,
        categorySlug: taxonomy.slug,
        subcategory: taxonomy.subcategories[1] || taxonomy.subcategories[0],
        targetLocation: regionalCity,
        workArrangement: WorkArrangement.ON_SITE,
        priority: 5,
        tags: ['regional_city', taxonomy.slug],
      });
    }

    // 6. Entry-level / Internship query
    results.push({
      queryText: `Junior ${taxonomy.titles[0]} or Internship Ethiopia`,
      categorySlug: taxonomy.slug,
      subcategory: taxonomy.subcategories[0],
      targetLocation: 'Ethiopia',
      experienceLevel: ExperienceLevel.ENTRY,
      employmentType: EmploymentType.INTERNSHIP,
      priority: 6,
      tags: ['entry_level', 'internship', taxonomy.slug],
    });

    return results.slice(0, options.maxQueries);
  }

  /**
   * Call Google Generative Language API for category expansion
   */
  private async queryGeminiForCategory(
    taxonomy: CategoryTaxonomy,
    options: {
      maxQueries: number;
      includeRemote: boolean;
      includeCities: boolean;
      includeLocal: boolean;
    }
  ): Promise<PlannedSearchItem[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const prompt = `You are an AI Search Planner for ETJobCollector (an Ethiopian job discovery platform).
Generate ${options.maxQueries} distinct, high-yield job search queries for the following profession:
Category: "${taxonomy.name}" (Slug: ${taxonomy.slug})
Known Titles: ${taxonomy.titles.slice(0, 5).join(', ')}
Key Specializations: ${taxonomy.specializations.join(', ')}

Requirements:
- Mix nationwide (Ethiopia), city-specific (e.g. Addis Ababa, Hawassa, Bahir Dar), and international remote queries open to Ethiopians.
- Include entry/junior roles and senior roles.
- Return ONLY valid JSON array adhering to this schema:
[
  {
    "queryText": "string",
    "subcategory": "string",
    "targetLocation": "string",
    "workArrangement": "ON_SITE" | "HYBRID" | "REMOTE",
    "employmentType": "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP",
    "experienceLevel": "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "LEAD",
    "priority": number (1 to 10),
    "tags": ["string"]
  }
]`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty AI response');
      }

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error('AI output is not an array');
      }

      return parsed.map((item: any) => ({
        queryText: String(item.queryText || `${taxonomy.name} Jobs Ethiopia`).trim(),
        categorySlug: taxonomy.slug,
        subcategory: item.subcategory ? String(item.subcategory).trim() : taxonomy.subcategories[0],
        targetLocation: item.targetLocation ? String(item.targetLocation).trim() : 'Ethiopia',
        workArrangement: (['ON_SITE', 'HYBRID', 'REMOTE'].includes(item.workArrangement)
          ? item.workArrangement
          : WorkArrangement.ON_SITE) as WorkArrangement,
        employmentType: (['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'].includes(item.employmentType)
          ? item.employmentType
          : EmploymentType.FULL_TIME) as EmploymentType,
        experienceLevel: (['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD'].includes(item.experienceLevel)
          ? item.experienceLevel
          : undefined) as ExperienceLevel | undefined,
        priority: typeof item.priority === 'number' ? Math.min(Math.max(item.priority, 1), 10) : 5,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [taxonomy.slug],
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Generate targeted searches specifically to fill identified coverage gaps
   */
  async generateTargetedSearchesForGaps(gaps: CoverageGapAnalysis[]): Promise<PlannedSearchItem[]> {
    const planned: PlannedSearchItem[] = [];

    for (const gap of gaps) {
      const taxonomy = PROFESSIONAL_TAXONOMY[gap.categorySlug];
      if (!taxonomy) continue;

      // Add high-priority gap filler queries
      const gapSearches: PlannedSearchItem[] = [
        {
          queryText: `${taxonomy.name} Vacancy Addis Ababa`,
          categorySlug: gap.categorySlug,
          subcategory: taxonomy.subcategories[0],
          targetLocation: 'Addis Ababa',
          workArrangement: WorkArrangement.ON_SITE,
          priority: 9, // Highest priority to resolve gap
          tags: ['gap_filler', 'urgent', gap.categorySlug],
        },
        {
          queryText: `${taxonomy.titles[0]} Ethiopia jobs`,
          categorySlug: gap.categorySlug,
          subcategory: taxonomy.subcategories[0],
          targetLocation: 'Ethiopia',
          workArrangement: WorkArrangement.ON_SITE,
          priority: 9,
          tags: ['gap_filler', gap.categorySlug],
        },
      ];

      // Add regional city query for gap
      if (ETHIOPIAN_CITIES.length > 2) {
        gapSearches.push({
          queryText: `${taxonomy.titles[1] || taxonomy.titles[0]} Hawassa OR Bahir Dar`,
          categorySlug: gap.categorySlug,
          subcategory: taxonomy.subcategories[0],
          targetLocation: 'Regional Ethiopia',
          priority: 8,
          tags: ['gap_filler', 'regional', gap.categorySlug],
        });
      }

      planned.push(...gapSearches);
    }

    return this.deduplicateSearches(planned);
  }
}

export const aiSearchPlannerService = new AISearchPlannerService();
