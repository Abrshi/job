export interface CategoryTaxonomy {
  slug: string;
  name: string;
  subcategories: string[];
  titles: string[];
  synonyms: string[];
  localTerms: string[]; // Amharic / local Ethiopian terminology
  specializations: string[];
}

export const ETHIOPIAN_CITIES = [
  'Addis Ababa',
  'Dire Dawa',
  'Hawassa',
  'Bahir Dar',
  'Mekelle',
  'Adama',
  'Jimma',
  'Gondar',
  'Bishoftu',
  'Dessie',
];

export const INTERNATIONAL_REMOTE_VARIANTS = [
  'Remote Ethiopia',
  'Worldwide Remote',
  'Work from Anywhere',
  'Global Remote',
  'Remote Africa',
  'EMEA Remote',
];

export const PROFESSIONAL_TAXONOMY: Record<string, CategoryTaxonomy> = {
  'software-it': {
    slug: 'software-it',
    name: 'Software & IT',
    subcategories: ['Software Engineering', 'DevOps & Cloud', 'IT Support', 'Cybersecurity', 'Database & Data', 'QA & Testing'],
    titles: [
      'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
      'Mobile App Developer', 'DevOps Engineer', 'Cloud Architect', 'System Administrator',
      'Database Administrator', 'IT Support Specialist', 'Network Engineer', 'QA Automation Engineer',
      'Data Engineer', 'Cybersecurity Analyst', 'Product Manager', 'Scrum Master',
    ],
    synonyms: ['Programmer', 'Web Developer', 'App Developer', 'IT Officer', 'Sysadmin', 'DBA', 'Coder'],
    localTerms: ['የሶፍትዌር ባለሙያ', 'አይቲ ኦፊሰር', 'የኔትወርክ ባለሙያ'],
    specializations: ['React', 'Node.js', 'Python', 'Java', 'Flutter', 'Docker', 'Kubernetes', 'AWS', 'PostgreSQL'],
  },

  'engineering-architecture': {
    slug: 'engineering-architecture',
    name: 'Engineering & Architecture',
    subcategories: ['Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Architecture', 'Structural Engineering'],
    titles: [
      'Civil Engineer', 'Electrical Engineer', 'Mechanical Engineer', 'Architect',
      'Structural Engineer', 'Electro-Mechanical Engineer', 'Sanitary Engineer',
      'Draftsperson', 'Quantity Surveyor', 'Project Engineer', 'Site Engineer',
    ],
    synonyms: ['Design Engineer', 'CAD Drafter', 'Resident Engineer', 'Consulting Engineer'],
    localTerms: ['ኢንጂነር', 'አርክቴክት', 'ሲቪል መሃንዲስ', 'ኤሌክትሪካል መሃንዲስ', 'የሳይት መሃንዲስ'],
    specializations: ['AutoCAD', 'Revit', 'Structural Analysis', 'HVAC', 'Power Systems', 'BIM'],
  },

  'healthcare-medicine': {
    slug: 'healthcare-medicine',
    name: 'Healthcare & Medicine',
    subcategories: ['Clinical Medicine', 'Nursing', 'Pharmacy', 'Public Health', 'Laboratory Technology'],
    titles: [
      'Medical Doctor', 'General Practitioner', 'Nurse', 'Clinical Nurse',
      'Pharmacist', 'Druggist', 'Laboratory Technologist', 'Public Health Officer',
      'Midwife', 'Health Officer', 'Medical Officer', 'Radiographer',
    ],
    synonyms: ['Physician', 'Clinical Officer', 'Health Specialist', 'Hospital Staff'],
    localTerms: ['ሀኪም', 'ነርስ', 'ፋርማሲስት', 'የጤና ባለሙያ', 'ላቦራቶሪ ቴክኒሽያን', 'አዋላጅ'],
    specializations: ['Pediatrics', 'Surgery', 'Maternal Health', 'Epidemiology', 'Clinical Pharmacy'],
  },

  'education-training': {
    slug: 'education-training',
    name: 'Education & Training',
    subcategories: ['Primary & Secondary Teaching', 'Higher Education', 'Vocational Training', 'Curriculum Design'],
    titles: [
      'Lecturer', 'Assistant Professor', 'Teacher', 'High School Teacher',
      'Primary School Teacher', 'Instructional Designer', 'Vocational Trainer',
      'Education Coordinator', 'School Principal', 'Tutor',
    ],
    synonyms: ['Instructor', 'Professor', 'Educator', 'Academic Facilitator'],
    localTerms: ['መምህር', 'አስተማሪ', 'ሌክቸረር', 'የስልጠና አስተባባሪ'],
    specializations: ['STEM', 'English Language', 'Special Needs Education', 'Curriculum Planning'],
  },

  'finance-accounting': {
    slug: 'finance-accounting',
    name: 'Finance & Accounting',
    subcategories: ['Accounting', 'Auditing', 'Financial Analysis', 'Banking', 'Taxation & Payroll'],
    titles: [
      'Senior Accountant', 'Junior Accountant', 'Internal Auditor', 'External Auditor',
      'Finance Manager', 'Financial Analyst', 'Branch Manager', 'Credit Analyst',
      'Loan Officer', 'Tax Specialist', 'Cashier', 'Treasury Officer',
    ],
    synonyms: ['Bookkeeper', 'Cost Accountant', 'Banking Officer', 'Accounts Clerk'],
    localTerms: ['ሂሳብ ሹም', 'ኦዲተር', 'የፋይናንስ ኦፊሰር', 'ካሺየር', 'የባንክ ባለሙያ', 'የብድር ኦፊሰር'],
    specializations: ['IFRS', 'Peachtree', 'QuickBooks', 'Financial Auditing', 'Tax Compliance'],
  },

  'business-management': {
    slug: 'business-management',
    name: 'Business & Management',
    subcategories: ['Operations Management', 'Project Management', 'General Management', 'Strategy & Consulting'],
    titles: [
      'Operations Manager', 'Project Manager', 'General Manager', 'Business Analyst',
      'Managing Director', 'Program Coordinator', 'Strategy Officer', 'Deputy Director',
    ],
    synonyms: ['Chief of Party', 'Executive Officer', 'Branch Director', 'Team Lead'],
    localTerms: ['ስራ አስኪያጅ', 'የፕሮጀክት አስተባባሪ', 'የቢዝነስ አማካሪ'],
    specializations: ['PMP', 'Operations Strategy', 'Agile', 'Budget Planning', 'Change Management'],
  },

  'sales-business-development': {
    slug: 'sales-business-development',
    name: 'Sales & Business Development',
    subcategories: ['B2B Sales', 'Retail Sales', 'Business Development', 'Account Management'],
    titles: [
      'Sales Representative', 'Sales Executive', 'Business Development Manager',
      'Key Account Manager', 'Sales Officer', 'Van Sales Representative',
      'Merchandiser', 'Commercial Officer', 'Sales Supervisor',
    ],
    synonyms: ['Salesperson', 'Sales Agent', 'Client Relations Lead', 'Sales Manager'],
    localTerms: ['የሽያጭ ሰራተኛ', 'የሽያጭ ኦፊሰር', 'የቢዝነስ ልማት ባለሙያ', 'መርቻንዳይዘር'],
    specializations: ['Lead Generation', 'FMCG Sales', 'B2B Pipeline', 'Client Retention'],
  },

  'marketing-communications': {
    slug: 'marketing-communications',
    name: 'Marketing & Communications',
    subcategories: ['Digital Marketing', 'Brand Strategy', 'Public Relations', 'Content & Copywriting'],
    titles: [
      'Digital Marketing Specialist', 'Marketing Officer', 'Marketing Manager',
      'Communications Officer', 'Public Relations Specialist', 'Brand Manager',
      'Social Media Specialist', 'Content Writer', 'Copywriter', 'Growth Marketer',
    ],
    synonyms: ['PR Officer', 'Media Officer', 'Campaign Coordinator', 'Ad Specialist'],
    localTerms: ['የማስታወቂያ ባለሙያ', 'የህዝብ ግንኙነት', 'የኮሙኒኬሽን ኦፊሰር', 'ዲጂታል ማርኬቲንግ'],
    specializations: ['SEO', 'Google Ads', 'Social Media Marketing', 'Copywriting', 'Press Relations'],
  },

  'customer-service-support': {
    slug: 'customer-service-support',
    name: 'Customer Service & Support',
    subcategories: ['Call Center', 'Customer Care', 'Help Desk', 'Client Support'],
    titles: [
      'Customer Service Representative', 'Call Center Agent', 'Customer Care Specialist',
      'Help Desk Specialist', 'Client Support Officer', 'Guest Relations Officer',
    ],
    synonyms: ['Support Agent', 'Contact Center Agent', 'Customer Advocate'],
    localTerms: ['የደንበኞች አገልግሎት', 'የኮል ሴንተር ሰራተኛ', 'የእንግዳ ተቀባይ'],
    specializations: ['CRM', 'Inbound Support', 'Conflict Resolution', 'Call Center Operations'],
  },

  'human-resources-recruitment': {
    slug: 'human-resources-recruitment',
    name: 'Human Resources & Recruitment',
    subcategories: ['Talent Acquisition', 'Employee Relations', 'HR Generalist', 'Compensation & Benefits'],
    titles: [
      'Human Resources Officer', 'HR Manager', 'Talent Acquisition Specialist',
      'Recruiter', 'HR Generalist', 'Personnel Officer', 'HR Assistant',
    ],
    synonyms: ['People Operations Specialist', 'Recruitment Officer', 'Staffing Coordinator'],
    localTerms: ['የሰው ኃይል ባለሙያ', 'የሰው ኃይል ኦፊሰር', 'የሰራተኞች አስተዳደር'],
    specializations: ['Ethiopian Labor Law', 'Payroll', 'Performance Management', 'Recruitment Pipeline'],
  },

  'administration-office-support': {
    slug: 'administration-office-support',
    name: 'Administration & Office Support',
    subcategories: ['Executive Support', 'Office Management', 'Front Desk', 'Records & Archives'],
    titles: [
      'Administrative Assistant', 'Office Manager', 'Executive Secretary',
      'Receptionist', 'Front Desk Officer', 'Data Entry Clerk', 'Liaison Officer',
      'Storekeeper', 'Archive Officer',
    ],
    synonyms: ['Office Administrator', 'Admin Clerk', 'Secretary', 'Personal Assistant'],
    localTerms: ['ጸሐፊ', 'የቢሮ አስተዳዳሪ', 'እንግዳ ተቀባይ', 'የመረጃ አስገባ', 'ጉዳይ አስፈፃሚ', 'መጋዘን ሰራተኛ'],
    specializations: ['Office Management', 'Document Control', 'Filing Systems', 'Liaison Support'],
  },

  'legal-compliance': {
    slug: 'legal-compliance',
    name: 'Legal & Compliance',
    subcategories: ['Corporate Law', 'Compliance', 'Litigation', 'Contract Management'],
    titles: [
      'Legal Counsel', 'Legal Officer', 'Compliance Officer', 'Contract Specialist',
      'Corporate Lawyer', 'Advocate', 'Legal Advisor',
    ],
    synonyms: ['Attorney', 'Legal Assistant', 'Paralegal', 'Regulatory Officer'],
    localTerms: ['ጠበቃ', 'የህግ ባለሙያ', 'የህግ አማካሪ', 'ኮምፕላያንስ ኦፊሰር'],
    specializations: ['Contract Law', 'Labor Proclamation', 'Commercial Law', 'Regulatory Compliance'],
  },

  'construction-real-estate': {
    slug: 'construction-real-estate',
    name: 'Construction & Real Estate',
    subcategories: ['Site Management', 'Real Estate Brokerage', 'Property Management', 'Foreman & Trades'],
    titles: [
      'Construction Project Manager', 'Site Supervisor', 'Foreman', 'Property Manager',
      'Real Estate Agent', 'Safety Officer', 'Quality Control Inspector',
    ],
    synonyms: ['Site Engineer', 'Construction Superintendent', 'Estate Officer'],
    localTerms: ['የግንባታ ተቆጣጣሪ', 'ፎርማን', 'የቤት ሽያጭ ወኪል', 'የሴፍቲ ኦፊሰር'],
    specializations: ['Safety Standards', 'Site Logistics', 'Contractor Management', 'Building Inspection'],
  },

  'manufacturing-industrial': {
    slug: 'manufacturing-industrial',
    name: 'Manufacturing & Industrial',
    subcategories: ['Production Management', 'Quality Assurance', 'Plant Maintenance', 'Machine Operation'],
    titles: [
      'Production Manager', 'Quality Control Chemist', 'Maintenance Technician',
      'Industrial Engineer', 'Plant Operator', 'Factory Supervisor',
    ],
    synonyms: ['Plant Manager', 'Process Engineer', 'Manufacturing Specialist'],
    localTerms: ['የምርት ክፍል ሃላፊ', 'የጥራት ተቆጣጣሪ', 'የፋብሪካ ሰራተኛ', 'ጥገና ቴክኒሽያን'],
    specializations: ['ISO 9001', 'Lean Manufacturing', 'Six Sigma', 'Preventive Maintenance'],
  },

  'logistics-supply-chain': {
    slug: 'logistics-supply-chain',
    name: 'Logistics & Supply Chain',
    subcategories: ['Procurement', 'Warehousing', 'Freight & Transport', 'Inventory Control'],
    titles: [
      'Procurement Officer', 'Logistics Coordinator', 'Warehouse Supervisor',
      'Supply Chain Manager', 'Purchasing Specialist', 'Transport Manager', 'Inventory Controller',
    ],
    synonyms: ['Purchaser', 'Fleet Officer', 'Logistics Specialist', 'Materials Manager'],
    localTerms: ['የግዥ ባለሙያ', 'የሎጂስቲክስ ኦፊሰር', 'የመጋዘን ሃላፊ', 'የስምሪት ሰራተኛ'],
    specializations: ['Incoterms', 'Customs Clearance', 'Warehouse Management', 'Vendor Evaluation'],
  },

  'agriculture-environment': {
    slug: 'agriculture-environment',
    name: 'Agriculture & Environment',
    subcategories: ['Agronomy', 'Horticulture', 'Livestock', 'Environmental Conservation', 'Agribusiness'],
    titles: [
      'Agronomist', 'Agricultural Officer', 'Horticulturist', 'Veterinary Officer',
      'Environmental Specialist', 'Agribusiness Manager', 'Irrigation Engineer',
    ],
    synonyms: ['Crop Specialist', 'Farm Manager', 'Conservationist', 'Agriculture Extension Worker'],
    localTerms: ['የግብርና ባለሙያ', 'የእንስሳት ሀኪም', 'አግሮኖሚስት', 'የአካባቢ ጥበቃ ባለሙያ'],
    specializations: ['Soil Science', 'Pest Management', 'Irrigation', 'Climate Adaptation'],
  },

  'hospitality-tourism': {
    slug: 'hospitality-tourism',
    name: 'Hospitality & Tourism',
    subcategories: ['Hotel Operations', 'Culinary Arts', 'Food & Beverage', 'Tour Guiding'],
    titles: [
      'Hotel General Manager', 'Front Office Manager', 'Executive Chef',
      'Food & Beverage Supervisor', 'Tour Guide', 'Housekeeping Supervisor', 'Barista',
    ],
    synonyms: ['Restaurant Manager', 'Catering Officer', 'Hospitality Lead'],
    localTerms: ['የሆቴል ስራ አስኪያጅ', 'ዋና ሼፍ', 'የቱር አስጎብኚ', 'አስተናጋጅ', 'ባሪስታ'],
    specializations: ['Menu Planning', 'HACCP', 'Customer Hospitality', 'Event Coordination'],
  },

  'media-design-creative': {
    slug: 'media-design-creative',
    name: 'Media, Design & Creative',
    subcategories: ['Graphic Design', 'UI/UX Design', 'Video Production', 'Journalism & Photography'],
    titles: [
      'Graphic Designer', 'UI/UX Designer', 'Video Editor', 'Motion Graphics Designer',
      'Photographer', 'Journalist', 'Creative Director', 'Audio Visual Specialist',
    ],
    synonyms: ['Visual Artist', 'Multimedia Specialist', 'Illustrator', 'Video Producer'],
    localTerms: ['ግራፊክ ዲዛይነር', 'ቪዲዮ ኤዲተር', 'ፎቶግራፈር', 'ጋዜጠኛ', 'የፈጠራ ባለሙያ'],
    specializations: ['Figma', 'Adobe Premiere', 'After Effects', 'Photoshop', 'Illustrator'],
  },

  'research-science': {
    slug: 'research-science',
    name: 'Research & Science',
    subcategories: ['Data Science & Analytics', 'Laboratory Science', 'Socio-Economic Research', 'Biotechnology'],
    titles: [
      'Data Scientist', 'Research Officer', 'Laboratory Scientist', 'Biostatistician',
      'Social Science Researcher', 'Economist', 'Monitoring & Evaluation (M&E) Officer',
    ],
    synonyms: ['Research Analyst', 'Scientific Officer', 'M&E Specialist', 'Evaluator'],
    localTerms: ['ተመራማሪ', 'የመረጃ ተንታኝ', 'የክትትልና ግምገማ ባለሙያ'],
    specializations: ['R / Python', 'SPSS / Stata', 'Survey Methodology', 'M&E Frameworks'],
  },

  'ngo-development-social-services': {
    slug: 'ngo-development-social-services',
    name: 'NGO, Development & Social Services',
    subcategories: ['Humanitarian Relief', 'Community Development', 'Grant Management', 'Child Protection & Gender'],
    titles: [
      'Program Officer', 'Grant Manager', 'Community Development Worker',
      'WASH Officer', 'Child Protection Specialist', 'Gender Specialist',
      'Livelihoods Officer', 'Field Coordinator',
    ],
    synonyms: ['Humanitarian Worker', 'Project Coordinator', 'Aid Worker', 'Social Worker'],
    localTerms: ['የልማት ሰራተኛ', 'የፕሮግራም ኦፊሰር', 'የህፃናት ጥበቃ', 'የማህበራዊ አገልግሎት ባለሙያ'],
    specializations: ['Grant Proposals', 'Sphere Standards', 'WASH', 'Community Mobilization'],
  },
};
