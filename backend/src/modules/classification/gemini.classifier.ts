import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { INITIAL_CATEGORIES } from '../../seeds/seed-categories';
import {
  ClassificationOutput,
  ClassificationOutputSchema,
  normalizeCategorySlug,
  CATEGORY_NAME_TO_SLUG_MAP,
} from './classification.types';

export const CLASSIFICATION_PROMPT_VERSION = 'v2.0.0';
export const DEFAULT_MODEL_IDENTIFIER = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const CATEGORY_LIST_FOR_PROMPT = INITIAL_CATEGORIES.map(
  (c) => `- ${c.slug}: "${c.name}" — ${c.description}`
).join('\n');

interface CategoryRule {
  slug: string;
  titleRegex: RegExp;
  responsibilityRegex?: RegExp;
}

const CATEGORY_RULES: CategoryRule[] = [
  // 1. Software & IT (strict: title or true engineering duties, never incidental tools)
  {
    slug: 'software-it',
    titleRegex: /\b(software\s*(developer|engineer|architect|programmer)|web\s*developer|frontend|backend|full\s*stack|devops|cloud\s*(engineer|architect)|qa\s*engineer|test\s*automation|database\s*administrator|dba\b|system\s*administrator|sysadmin|network\s*(engineer|admin)|it\s*(support|officer|specialist|technician|administrator|manager)|information\s*technology\s*(officer|admin|specialist)|programmer|coder|mobile\s*developer|android\s*developer|ios\s*developer|react\s*developer|node\s*developer|python\s*developer|java\s*developer|scrum\s*master|cybersecurity|infosec|hardware\s*&\s*network|mis\s*&\s*information\s*technology)\b/i,
    responsibilityRegex: /\b(writing\s*clean\s*code|software\s*development|deploying\s*code|git\s*repository|ci\/cd\s*pipeline|docker\s*container|rest\s*api\s*development|microservices\s*architecture|database\s*schema\s*design|hardware\s*and\s*network\s*troubleshooting|configuring\s*servers)\b/i,
  },
  // 2. Sales & Business Development
  {
    slug: 'sales-business-development',
    titleRegex: /\b(sales(\s*(representative|officer|executive|agent|manager|specialist|person|consultant|director|lead|supervisor))?|business\s*development(\s*(officer|manager|representative|specialist))?|account\s*(executive|manager)|b2b\s*sales|commercial\s*officer|relationship\s*manager|distributor\s*manager|merchandiser|telemarketing|van\s*sales|retail\s*sales|የሽያጭ)\b/i,
    responsibilityRegex: /\b(sales\s*targets|lead\s*generation|prospecting|closing\s*deals|customer\s*acquisition|client\s*pipeline|distributor\s*management|commercial\s*contracts|sales\s*revenue|achieving\s*quota|product\s*demonstration)\b/i,
  },
  // 3. Marketing & Communications
  {
    slug: 'marketing-communications',
    titleRegex: /\b(digital\s*marketing|marketing\s*(specialist|officer|manager|coordinator|executive|lead|analyst)|brand\s*(manager|strategist)|social\s*media(\s*specialist|\s*manager)?|seo\s*specialist|content\s*(creator|writer|strategist)|pr\s*(officer|specialist)|public\s*relations|communications?\s*(officer|specialist|manager)|copywriter|growth\s*marketer|advertising)\b/i,
    responsibilityRegex: /\b(marketing\s*plans|digital\s*campaigns|social\s*media\s*campaigns|brand\s*awareness|seo|sem|content\s*strategy|press\s*releases|promotional\s*materials|media\s*relations)\b/i,
  },
  // 4. Finance & Accounting
  {
    slug: 'finance-accounting',
    titleRegex: /\b(accountant|accounting|auditor|audit|finance\s*(officer|manager|director|analyst|controller)|financial\s*(analyst|controller|consultant)|head\s*of\s*finance|cfo\b|treasurer|treasury|payroll\s*officer|tax\s*(officer|specialist|advisor)|bookkeeper|banking\s*officer|loan\s*officer|credit\s*(officer|analyst)|microfinance)\b/i,
    responsibilityRegex: /\b(financial\s*(statements?|reports?|reporting)|balance\s*sheets?|general\s*ledgers?|reconciliations?|bookkeep(ing)?|tax\s*(filing|payments?|returns?|compliance)|statutory\s*audits?|accounts\s*(payable|receivable)|ifrs|gaap|budgeting\s*and\s*forecasting)\b/i,
  },
  // 5. HR & Recruitment
  {
    slug: 'human-resources-recruitment',
    titleRegex: /\b(human\s*resources|hr\s*(officer|manager|specialist|generalist|coordinator|assistant|director)|recruiter|recruitment\s*officer|talent\s*acquisition|people\s*operations|personnel\s*officer|compensation\s*and\s*benefits)\b/i,
    responsibilityRegex: /\b(onboarding|staff\s*recruitment|talent\s*sourcing|employee\s*relations|performance\s*appraisal|labor\s*proclamation|disciplinary\s*procedures|leave\s*management|payroll\s*preparation)\b/i,
  },
  // 6. Customer Service & Support
  {
    slug: 'customer-service-support',
    titleRegex: /\b(customer\s*service(\s*(representative|officer|agent|specialist|manager))?|customer\s*care|customer\s*support|call\s*center\s*agent|contact\s*center|client\s*support|guest\s*relations|helpdesk\s*agent)\b/i,
    responsibilityRegex: /\b(customer\s*inquiries|customer\s*complaints|answering\s*customer\s*calls|customer\s*satisfaction|ticket\s*resolution|inbound\s*calls)\b/i,
  },
  // 7. Administration & Office Support
  {
    slug: 'administration-office-support',
    titleRegex: /\b(administrat(ive|ion)\s*(assistant|officer|clerk|manager)|office\s*(assistant|manager|clerk|coordinator)|secretary|executive\s*assistant|receptionist|front\s*desk|store\s*keeper|storekeeper|records\s*officer|archive\s*officer|data\s*entry|liaison\s*officer|clerk)\b/i,
    responsibilityRegex: /\b(handling\s*office\s*correspondence|front\s*desk\s*management|scheduling\s*appointments|maintaining\s*office\s*files|office\s*supplies|inventory\s*receiving|document\s*archiving)\b/i,
  },
  // 8. Engineering & Architecture
  {
    slug: 'engineering-architecture',
    titleRegex: /\b(civil\s*engineer|mechanical\s*engineer|electrical\s*engineer|structural\s*engineer|architect|architectural|electro-mechanical|sanitary\s*engineer|surveyor|quantity\s*surveyor|drafter|draftsperson)\b/i,
    responsibilityRegex: /\b(engineering\s*designs|structural\s*analysis|cad\s*drawings|revit|hvac|piping|electrical\s*installations|bill\s*of\s*quantities|boq|site\s*investigation)\b/i,
  },
  // 9. Design & Creative
  {
    slug: 'design-creative',
    titleRegex: /\b(graphic\s*designer|ui\/ux\s*designer|product\s*designer|visual\s*designer|illustrator|animator|art\s*director|creative\s*designer|creative\s*director|multimedia\s*designer|fashion\s*designer)\b/i,
    responsibilityRegex: /\b(graphic\s*assets|photoshop|illustrator|figma|branding\s*guidelines|layout\s*design|visual\s*concepts|typography|creative\s*artwork)\b/i,
  },
  // 10. Media
  {
    slug: 'media',
    titleRegex: /\b(journalist|reporter|editor|broadcast|news\s*anchor|videographer|video\s*editor|photographer|radio\s*host|media\s*producer|media\s*specialist)\b/i,
    responsibilityRegex: /\b(video\s*editing|news\s*reporting|conducting\s*interviews|broadcasting|scriptwriting|media\s*production|photo\s*shoots)\b/i,
  },
  // 11. Healthcare & Medicine
  {
    slug: 'healthcare-medicine',
    titleRegex: /\b(medical\s*doctor|physician|nurse|pharmacist|pharmacy|surgeon|dentist|radiologist|lab\s*technician|medical\s*laboratory|public\s*health|clinical\s*officer|midwife|health\s*officer)\b/i,
    responsibilityRegex: /\b(patient\s*care|clinical\s*diagnosis|dispensing\s*medication|medical\s*treatments|laboratory\s*tests|hospital\s*ward|patient\s*consultations)\b/i,
  },
  // 12. Education & Training
  {
    slug: 'education-training',
    titleRegex: /\b(teacher|school\s*teacher|lecturer|professor|instructor|tutor|trainer|curriculum\s*developer|pedagogy|principal|academic\s*coordinator)\b/i,
    responsibilityRegex: /\b(lesson\s*plans|teaching\s*students|classroom\s*instruction|student\s*assessment|grading|academic\s*curriculum|pedagogical)\b/i,
  },
  // 13. Logistics & Supply Chain
  {
    slug: 'logistics-supply-chain',
    titleRegex: /\b(logistics\s*(coordinator|officer|manager|specialist)|supply\s*chain|procurement\s*(officer|specialist|manager)|purchasing\s*officer|warehouse\s*(supervisor|officer|manager)|freight|transport\s*coordinator|customs\s*clearing|shipping\s*officer)\b/i,
    responsibilityRegex: /\b(supply\s*chain|clearing\s*customs|shipping\s*documents|bill\s*of\s*lading|procurement\s*process|purchase\s*orders|freight\s*forwarding|warehouse\s*operations)\b/i,
  },
  // 14. Manufacturing & Industrial
  {
    slug: 'manufacturing-industrial',
    titleRegex: /\b(production\s*(supervisor|manager|engineer|officer)|manufacturing\s*(supervisor|manager|engineer)|plant\s*(manager|engineer)|factory\s*(manager|supervisor)|quality\s*control\s*(inspector|officer)|quality\s*assurance\s*(officer|technician)|machinist|machine\s*operator|industrial\s*technician|assembly\s*supervisor)\b/i,
    responsibilityRegex: /\b(manufacturing\s*process|production\s*line|plant\s*efficiency|factory\s*floor|preventive\s*maintenance\s*of\s*machines|quality\s*inspections|batch\s*production)\b/i,
  },
  // 15. Construction & Real Estate
  {
    slug: 'construction-real-estate',
    titleRegex: /\b(construction\s*(manager|supervisor|engineer)|site\s*engineer|site\s*supervisor|foreman|real\s*estate\s*(agent|manager)|property\s*manager|batching\s*plant)\b/i,
    responsibilityRegex: /\b(construction\s*site|concrete\s*casting|building\s*construction|subcontractors|site\s*supervision|property\s*leasing)\b/i,
  },
  // 16. Legal & Compliance
  {
    slug: 'legal-compliance',
    titleRegex: /\b(lawyer|attorney|legal\s*(counsel|officer|advisor|consultant|manager)|compliance\s*(officer|manager|specialist)|advocate|paralegal)\b/i,
    responsibilityRegex: /\b(legal\s*opinions|court\s*representation|contract\s*drafting|regulatory\s*compliance|legal\s*agreements|statutory\s*regulations)\b/i,
  },
  // 17. Agriculture & Environment
  {
    slug: 'agriculture-environment',
    titleRegex: /\b(agronomist|agriculture\s*(officer|expert)|veterinarian|horticulture|forestry|environmental\s*(officer|specialist|expert)|irrigation\s*engineer|farm\s*manager)\b/i,
    responsibilityRegex: /\b(crop\s*production|soil\s*fertility|irrigation|livestock\s*management|agricultural\s*extension|environmental\s*impact)\b/i,
  },
  // 18. Hospitality & Tourism
  {
    slug: 'hospitality-tourism',
    titleRegex: /\b(hotel\s*manager|chef|head\s*cook|waiter|waitress|bartender|barista|housekeeping|tour\s*guide|travel\s*consultant|f&b|food\s*and\s*beverage|restaurant\s*manager|catering)\b/i,
    responsibilityRegex: /\b(culinary|food\s*preparation|room\s*service|guest\s*hospitality|restaurant\s*operations|tour\s*itineraries)\b/i,
  },
  // 19. Research & Science
  {
    slug: 'research-science',
    titleRegex: /\b(researcher|research\s*scientist|data\s*scientist|statistician|economist|biologist|chemist|laboratory\s*analyst|monitoring\s*and\s*evaluation|m&e\s*officer)\b/i,
    responsibilityRegex: /\b(scientific\s*research|statistical\s*analysis|laboratory\s*experiments|baseline\s*surveys|data\s*collection\s*methodology)\b/i,
  },
  // 20. NGO / Development & Social Services
  {
    slug: 'ngo-development-social-services',
    titleRegex: /\b(ngo\s*(officer|coordinator)|humanitarian|community\s*development|child\s*protection|social\s*worker|livelihood\s*officer|wash\s*officer|relief\s*officer|grant\s*(manager|officer))\b/i,
    responsibilityRegex: /\b(donor\s*reporting|humanitarian\s*relief|beneficiary\s*selection|community\s*engagement|grant\s*proposals)\b/i,
  },
  // 21. Business & Management
  {
    slug: 'business-management',
    titleRegex: /\b(general\s*manager|managing\s*director|operations\s*manager|business\s*manager|branch\s*manager|project\s*manager|business\s*analyst|management\s*consultant|country\s*director|ceo\b|coo\b)\b/i,
    responsibilityRegex: /\b(overall\s*operations|strategic\s*planning|business\s*strategy|cross-functional\s*teams|organizational\s*performance)\b/i,
  },
];

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
   * Deterministic heuristic classifier based on strict occupational function hierarchy.
   * Prevents incidental software/tools (e.g. CRM, Excel, MS Office) or employer industry
   * from overriding the candidate's actual job title and daily responsibilities.
   */
  classifyHeuristic(title: string, description: string): ClassificationOutput {
    const normTitle = (title || '').trim();
    const normDesc = (description || '').trim();
    const lowerTitle = normTitle.toLowerCase();
    const lowerDesc = normDesc.toLowerCase();

    // Clean incidental software tools and non-IT skills from description
    const cleanedDesc = lowerDesc
      .replace(/\b(crm|erp|accounting|office|sales|billing|inventory|pos|payroll|recruitment)\s+software\b/gi, 'tool')
      .replace(/\b(ms\s*office|excel|word|powerpoint|spreadsheets|google\s*workspace)\b/gi, 'office_app')
      .replace(/\b(technical\s*skills|analytical\s*(skills|mindset)|computer\s*literacy)\b/gi, 'general_aptitude');

    // 1. Disambiguate hybrid Sales & Marketing roles
    const isMarketingAndSales =
      /\b(marketing\s*(and|&)\s*sales|sales\s*(and|&)\s*marketing)\b/i.test(lowerTitle) ||
      (/\bmarketing\b/i.test(lowerTitle) && /\bsales\b/i.test(lowerTitle));

    if (isMarketingAndSales) {
      const hasSalesTargets = /\b(sales\s*targets?|leads?|quota|distributor|revenue|merchandis)/i.test(cleanedDesc);
      const primarySlug = hasSalesTargets || !/\bbrand\b/i.test(lowerTitle)
        ? 'sales-business-development'
        : 'marketing-communications';
      const secondarySlug = primarySlug === 'sales-business-development'
        ? 'marketing-communications'
        : 'sales-business-development';

      return {
        categorySlug: primarySlug,
        primaryCategory: primarySlug,
        secondaryCategories: [secondarySlug],
        experienceLevel: this.extractExperienceLevel(`${normTitle} ${normDesc}`),
        confidence: 0.94,
        explanation: `Classified into '${primarySlug}' based on primary commercial & revenue responsibilities in title '${normTitle}', with secondary function in '${secondarySlug}'.`,
        skills: this.extractSkills(`${normTitle} ${normDesc}`, primarySlug),
      };
    }

    // 2. Score categories with massive weight given to the professional title
    let bestSlug = 'business-management';
    let bestScore = 0;
    let secondarySlug: string | undefined = undefined;
    let secondScore = 0;

    for (const rule of CATEGORY_RULES) {
      let score = 0;

      // Title matches provide the primary occupational identity (100 points)
      if (rule.titleRegex.test(lowerTitle)) {
        score += 100;
      }

      // Action verbs and duties in cleaned description (25 points)
      if (rule.responsibilityRegex && rule.responsibilityRegex.test(cleanedDesc)) {
        score += 25;
      }

      // Hard constraint: Software & IT can NEVER match if title clearly belongs to another profession
      if (rule.slug === 'software-it') {
        const isOtherProfessionTitle = /\b(accountant|marketing|sales|hr|human\s*resources|nurse|doctor|teacher|receptionist|storekeeper|cook|chef|civil\s*engineer|driver|cleaner|production|machinist)\b/i.test(lowerTitle);
        if (isOtherProfessionTitle) {
          score = 0; // Disqualified from Software & IT
        }
      }

      if (score > bestScore) {
        secondScore = bestScore;
        secondarySlug = bestSlug !== 'business-management' ? bestSlug : undefined;
        bestScore = score;
        bestSlug = rule.slug;
      } else if (score > secondScore && score > 20) {
        secondScore = score;
        secondarySlug = rule.slug;
      }
    }

    // 3. Fallback for generic/missing title based on duty evidence in description
    if (bestScore === 0) {
      for (const rule of CATEGORY_RULES) {
        if (rule.responsibilityRegex && rule.responsibilityRegex.test(cleanedDesc)) {
          bestSlug = rule.slug;
          bestScore = 30;
          break;
        }
      }
    }

    const confidence = bestScore >= 100 ? 0.95 : bestScore >= 25 ? 0.85 : 0.70;
    const secondaryCategories = secondarySlug && secondarySlug !== bestSlug ? [secondarySlug] : [];

    return {
      categorySlug: bestSlug,
      primaryCategory: bestSlug,
      secondaryCategories,
      experienceLevel: this.extractExperienceLevel(`${normTitle} ${normDesc}`),
      confidence,
      explanation: `Classified into '${bestSlug}' based on primary occupational function in title and responsibilities.`,
      skills: this.extractSkills(`${normTitle} ${normDesc}`, bestSlug),
    };
  }

  private extractExperienceLevel(text: string): 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE' | 'UNSPECIFIED' {
    if (/\b(director|chief|cfo|ceo|coo|head\s*of|vp|general\s*manager|executive)\b/i.test(text)) {
      return 'EXECUTIVE';
    }
    if (/\b(team\s*lead|tech\s*lead|lead\s*architect|principal)\b/i.test(text)) {
      return 'LEAD';
    }
    if (/\b(senior|sr\.|5\+\s*years|6\+\s*years|7\+\s*years|8\+\s*years|10\+\s*years)\b/i.test(text)) {
      return 'SENIOR';
    }
    if (/\b(mid\s*level|intermediate|3\+\s*years|4\+\s*years|3-5\s*years|2-4\s*years)\b/i.test(text)) {
      return 'MID';
    }
    if (/\b(junior|jr\.|1\+\s*year|1-2\s*years|2\+\s*years)\b/i.test(text)) {
      return 'JUNIOR';
    }
    if (/\b(entry\s*level|fresh\s*graduate|intern|internship|no\s*experience)\b/i.test(text)) {
      return 'ENTRY';
    }
    return 'UNSPECIFIED';
  }

  private extractSkills(text: string, categorySlug: string): string[] {
    const skills: string[] = [];
    if (/crm/i.test(text)) skills.push('CRM');
    if (/digital\s*campaign/i.test(text)) skills.push('Digital Campaigns');
    if (/react/i.test(text)) skills.push('React');
    if (/node/i.test(text)) skills.push('Node.js');
    if (/typescript/i.test(text)) skills.push('TypeScript');
    if (/sql|mysql/i.test(text)) skills.push('SQL');
    if (/accounting|tax|audit/i.test(text)) skills.push('Financial Accounting');
    if (/sales\s*target|lead\s*gen/i.test(text)) skills.push('Sales Management');
    if (/recruitment|talent/i.test(text)) skills.push('Talent Acquisition');
    if (/photoshop|illustrator|figma/i.test(text)) skills.push('Graphic Design');
    return skills.slice(0, 8);
  }

  async classifyJob(title: string, description: string): Promise<ClassificationOutput> {
    if (!this.apiKey) {
      // Use fallback heuristic when API key is not configured
      return this.classifyHeuristic(title, description);
    }

    const systemPrompt = `You are an expert AI job taxonomy classifier for an employment platform.
Your task is to analyze the following job vacancy and classify it strictly according to the candidate's actual professional function, responsibilities, and qualifications, rather than incidental keywords, tools, or the employer's industry.

Available Categories (select exactly one matching primary slug):
${CATEGORY_LIST_FOR_PROMPT}

CRITICAL TAXONOMY CLASSIFICATION RULES:
1. ORDER OF EVIDENCE:
   a. Actual job responsibilities and daily activities (MOST IMPORTANT).
   b. Job title and core professional function.
   c. Required qualifications and professional training.
   d. Required specialized skills.
   e. Industry context (ONLY to distinguish similar roles; NEVER override the job function).

2. ANTI-MISCLASSIFICATION GUARDRAILS:
   - "Software & IT" is STRICTLY for software developers, programmers, sysadmins, DevOps, network engineers, IT support, QA, database administrators, and cloud engineers.
   - Incidental tools and software DO NOT mean Software & IT!
     * "CRM software" in sales/marketing does NOT make it Software & IT.
     * "Accounting software" (e.g. QuickBooks, Peachtree) in accounting does NOT make it Software & IT.
     * "MS Office", "Excel", "spreadsheets", or "computer literacy" does NOT make it Software & IT.
     * "Technical skills" or "analytical mindset" does NOT make it Software & IT.
   - Employer industry DOES NOT define the job function:
     * An accountant at a software company is Finance & Accounting (NOT Software & IT).
     * A software developer at a hospital or NGO is Software & IT (NOT Healthcare or NGO).
     * A marketing/sales officer at a manufacturing plant is Sales & Business Development (NOT Manufacturing).
     * A receptionist at a construction firm is Administration & Office Support (NOT Construction).
   - HYBRID ROLES:
     * Select the primary category based on dominant responsibilities and core mission.
     * Example: "Marketing and Sales Officer" -> primaryCategory: "sales-business-development", secondaryCategories: ["marketing-communications"].

3. REQUIRED JSON OUTPUT SCHEMA:
Return your response ONLY as a valid JSON object matching this structure:
{
  "categorySlug": "<exact slug from the category list>",
  "primaryCategory": "<exact slug from the category list>",
  "secondaryCategories": ["<optional secondary slug>"],
  "experienceLevel": "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE" | "UNSPECIFIED",
  "confidence": <float between 0.00 and 1.00>,
  "explanation": "<concise factual sentence justifying the category and experience level based on job title and daily responsibilities>",
  "skills": ["<up to 8 relevant professional skills>"],
  "industry": "<optional employer sector, e.g. Manufacturing, Healthcare, Finance, NGO>"
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

        // Normalize slugs if model returned human-readable names or primaryCategory
        const rawSlug = parsedJson.categorySlug || parsedJson.primaryCategory || '';
        const normalizedSlug = normalizeCategorySlug(rawSlug);
        parsedJson.categorySlug = normalizedSlug;
        parsedJson.primaryCategory = normalizedSlug;

        if (Array.isArray(parsedJson.secondaryCategories)) {
          parsedJson.secondaryCategories = parsedJson.secondaryCategories.map((s: string) => normalizeCategorySlug(s));
        } else {
          parsedJson.secondaryCategories = [];
        }

        if (parsedJson.reason && !parsedJson.explanation) {
          parsedJson.explanation = parsedJson.reason;
        }

        const validated = ClassificationOutputSchema.parse(parsedJson);

        // Verify category slug actually exists in INITIAL_CATEGORIES
        const categoryExists = INITIAL_CATEGORIES.some((c) => c.slug === validated.categorySlug);
        if (!categoryExists) {
          logger.warn(`Model returned unlisted slug '${validated.categorySlug}', falling back to heuristic.`);
          return this.classifyHeuristic(title, description);
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
