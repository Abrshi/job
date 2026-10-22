import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { INITIAL_CATEGORIES } from '../../seeds/seed-categories';
import {
  ClassificationOutput,
  ClassificationOutputSchema,
} from './classification.types';
import { AppError } from '../../middleware/error-handler';

export const CLASSIFICATION_PROMPT_VERSION = 'v1.0.0';
export const DEFAULT_MODEL_IDENTIFIER = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const CATEGORY_LIST_FOR_PROMPT = INITIAL_CATEGORIES.map(
  (c) => `- ${c.slug}: "${c.name}" (${c.description})`
).join('\n');

export class GeminiClassifier {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(apiKey = env.GEMINI_API_KEY, model = DEFAULT_MODEL_IDENTIFIER) {
    this.apiKey = apiKey;
    this.model = model;
  }

  get promptVersion(): string {
    return CLASSIFICATION_PROMPT_VERSION;
  }

  get modelIdentifier(): string {
    return this.apiKey ? this.model : `${this.model}-heuristic-fallback`;
  }

  /**
   * Deterministic heuristic classifier used when GEMINI_API_KEY is not set or in offline/test mode.
   */
  classifyHeuristic(title: string, description: string): ClassificationOutput {
    const text = `${title} ${description}`.toLowerCase();

    // 1. Determine Category
    let categorySlug = 'business-management'; // default general category
    let confidence = 0.75;
    const skills: string[] = [];

    if (
      /software|developer|frontend|backend|fullstack|devops|react|node|python|java|typescript|sql|database|programmer|engineer.*software/i.test(
        text
      )
    ) {
      categorySlug = 'software-it';
      confidence = 0.95;
      if (/react/i.test(text)) skills.push('React');
      if (/node/i.test(text)) skills.push('Node.js');
      if (/typescript/i.test(text)) skills.push('TypeScript');
      if (/sql|mysql/i.test(text)) skills.push('MySQL');
    } else if (/accountant|audit|finance|payroll|tax|quickbooks|banking/i.test(text)) {
      categorySlug = 'finance-accounting';
      confidence = 0.92;
      skills.push('Accounting', 'Financial Reporting');
    } else if (/doctor|nurse|clinic|pharmacy|hospital|health|medicine/i.test(text)) {
      categorySlug = 'healthcare-medicine';
      confidence = 0.93;
    } else if (/teacher|lecturer|tutor|professor|school|curriculum|education/i.test(text)) {
      categorySlug = 'education-training';
      confidence = 0.90;
    } else if (/graphic|video|illustrator|photoshop|premiere|designer|ui\/ux|creative|art/i.test(text)) {
      categorySlug = 'media-design-creative';
      confidence = 0.92;
      if (/photoshop/i.test(text)) skills.push('Photoshop');
      if (/illustrator/i.test(text)) skills.push('Illustrator');
    } else if (/civil|mechanical|electrical|architect|structural/i.test(text)) {
      categorySlug = 'engineering-architecture';
      confidence = 0.91;
    } else if (/logistics|warehouse|supply chain|procurement|freight/i.test(text)) {
      categorySlug = 'logistics-supply-chain';
      confidence = 0.90;
    } else if (/sales|account manager|business development|b2b/i.test(text)) {
      categorySlug = 'sales-business-development';
      confidence = 0.88;
    } else if (/marketing|seo|social media|pr|public relations|content/i.test(text)) {
      categorySlug = 'marketing-communications';
      confidence = 0.89;
    } else if (/hr|human resources|recruiter|talent acquisition/i.test(text)) {
      categorySlug = 'human-resources-recruitment';
      confidence = 0.90;
    } else if (/legal|compliance|lawyer|counsel|attorney/i.test(text)) {
      categorySlug = 'legal-compliance';
      confidence = 0.92;
    } else if (/admin|clerk|office support|secretary|receptionist|front desk/i.test(text)) {
      categorySlug = 'administration-office-support';
      confidence = 0.90;
    } else if (/ngo|humanitarian|aid|community development/i.test(text)) {
      categorySlug = 'ngo-development-social-services';
      confidence = 0.89;
    }

    // 2. Determine Experience Level with explicit textual evidence
    let experienceLevel: 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE' | 'UNSPECIFIED' = 'UNSPECIFIED';

    if (/\b(senior|sr\.|lead|5\+ years|6\+ years|7\+ years|8\+ years|10\+ years)\b/i.test(text)) {
      experienceLevel = 'SENIOR';
    } else if (/\b(junior|jr\.|1\+ year|1-2 years)\b/i.test(text)) {
      experienceLevel = 'JUNIOR';
    } else if (/\b(entry level|fresh graduate|no experience|intern|internship)\b/i.test(text)) {
      experienceLevel = 'ENTRY';
    } else if (/\b(mid level|2\+ years|3\+ years|3-5 years|2-4 years)\b/i.test(text)) {
      experienceLevel = 'MID';
    } else if (/\b(director|chief|head of|vp|executive)\b/i.test(text)) {
      experienceLevel = 'EXECUTIVE';
    }

    const explanation = `Classified into '${categorySlug}' based on matching job title and requirements. Experience level identified as '${experienceLevel}' from text evidence.`;

    return {
      categorySlug,
      experienceLevel,
      confidence,
      explanation,
      skills,
    };
  }

  async classifyJob(title: string, description: string): Promise<ClassificationOutput> {
    if (!this.apiKey) {
      // Use fallback heuristic when API key is not configured
      return this.classifyHeuristic(title, description);
    }

    const systemPrompt = `You are an expert AI job taxonomy classifier for an employment platform.
Your task is to analyze the following job vacancy and classify it strictly according to the specified rules.

Available Categories (select exactly one matching slug):
${CATEGORY_LIST_FOR_PROMPT}

Rules:
1. "categorySlug": MUST be exactly one of the slugs listed above. DO NOT invent categories.
2. "experienceLevel": MUST be one of: 'ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNSPECIFIED'.
   CRITICAL: ONLY assign an experience level if there is EXPLICIT evidence in the posting (e.g. "Senior", "5+ years", "Entry level", "Fresh graduate"). If missing or ambiguous, you MUST assign 'UNSPECIFIED'. Never assume missing experience means junior or entry.
3. "confidence": A float between 0.00 and 1.00 indicating classification certainty.
4. "explanation": A concise, factual sentence justifying the category and experience level based directly on posting text.
5. "skills": An array of up to 8 relevant technical, professional, or domain skills found in the text.

Return your response ONLY as a valid JSON object matching this structure:
{
  "categorySlug": "...",
  "experienceLevel": "...",
  "confidence": 0.95,
  "explanation": "...",
  "skills": ["Skill1", "Skill2"]
}`;

    const userPrompt = `Job Title: ${title}
Job Description:
${description.slice(0, 3000)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    let attempts = 0;
    const maxAttempts = 3;
    let lastError: unknown = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = (await response.json()) as any;
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) {
          throw new Error('Gemini API returned empty candidate response');
        }

        const parsedJson = JSON.parse(candidate);
        const validated = ClassificationOutputSchema.parse(parsedJson);

        // Verify category slug actually exists in INITIAL_CATEGORIES
        const categoryExists = INITIAL_CATEGORIES.some((c) => c.slug === validated.categorySlug);
        if (!categoryExists) {
          throw new Error(`Model returned unsupported category slug: '${validated.categorySlug}'`);
        }

        return validated;
      } catch (err: unknown) {
        lastError = err;
        logger.warn(`Gemini classification attempt ${attempts} failed: ${(err as Error).message}`);
        if (attempts < maxAttempts) {
          // Bounded exponential backoff: 500ms, 1000ms
          await new Promise((r) => setTimeout(r, 500 * attempts));
        }
      }
    }

    logger.error('Gemini classification exhausted retries. Falling back to heuristic classifier.', {
      error: (lastError as Error)?.message,
    });

    // If live API calls fail after retries, return deterministic fallback rather than crashing
    return this.classifyHeuristic(title, description);
  }
}

export const geminiClassifier = new GeminiClassifier();
