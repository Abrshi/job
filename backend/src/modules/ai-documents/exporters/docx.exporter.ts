import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { GeneratedDocumentType, StructuredCvData } from '../ai-documents.types';

export interface DocxExportOptions {
  title: string;
  documentType: GeneratedDocumentType;
  content: string;
  structuredData?: any;
  subjectLine?: string | null;
  candidateName?: string;
  targetJobTitle?: string;
  targetCompanyName?: string;
}

export class DocxExporter {
  async exportToBuffer(options: DocxExportOptions): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];

    if (options.documentType === 'TAILORED_CV' && options.structuredData?.header) {
      this.buildStructuredCv(options.structuredData as StructuredCvData, paragraphs);
    } else {
      this.buildGeneralDocument(options, paragraphs);
    }

    // Disclaimer footer paragraph
    paragraphs.push(
      new Paragraph({
        spacing: { before: 400 },
        children: [
          new TextRun({
            text: 'Draft prepared for candidate review • Generated on Starcher Platform',
            italics: true,
            size: 16, // 8pt
            color: '64748B',
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                bottom: 1000,
                left: 1000,
                right: 1000,
              },
            },
          },
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  private buildStructuredCv(data: StructuredCvData, paragraphs: Paragraph[]) {
    // Name
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: data.header.fullName || 'Candidate Name',
            bold: true,
            size: 36, // 18pt
            color: '0F172A',
          }),
        ],
      })
    );

    // Headline
    if (data.header.headline) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: data.header.headline,
              color: '2563EB',
              bold: true,
              size: 22, // 11pt
            }),
          ],
        })
      );
    }

    // Contact info
    const contactParts = [
      data.header.email,
      data.header.phone,
      data.header.location,
    ].filter(Boolean);

    if (contactParts.length > 0) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 250 },
          children: [
            new TextRun({
              text: contactParts.join('  •  '),
              color: '64748B',
              size: 18, // 9pt
            }),
          ],
        })
      );
    }

    // Professional Summary
    if (data.professionalSummary) {
      this.addSectionHeader('PROFESSIONAL SUMMARY', paragraphs);
      paragraphs.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: data.professionalSummary,
              size: 20, // 10pt
              color: '334155',
            }),
          ],
        })
      );
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      this.addSectionHeader('CORE SKILLS & EXPERTISE', paragraphs);
      for (const group of data.skills) {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `${group.category}: `,
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: group.items.join(', '),
                size: 20,
                color: '334155',
              }),
            ],
          })
        );
      }
    }

    // Work Experience
    if (data.experience && data.experience.length > 0) {
      this.addSectionHeader('WORK EXPERIENCE', paragraphs);
      for (const item of data.experience) {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 150, after: 60 },
            children: [
              new TextRun({
                text: item.title,
                bold: true,
                size: 22, // 11pt
                color: '0F172A',
              }),
              new TextRun({
                text: `  •  ${item.company}`,
                italics: true,
                color: '64748B',
                size: 20,
              }),
              new TextRun({
                text: item.period ? ` (${item.period})` : '',
                color: '64748B',
                size: 18,
              }),
            ],
          })
        );

        if (item.bullets && item.bullets.length > 0) {
          for (const bullet of item.bullets) {
            paragraphs.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: bullet,
                    size: 20,
                    color: '334155',
                  }),
                ],
              })
            );
          }
        }
      }
    }

    // Education
    if (data.education && data.education.length > 0) {
      this.addSectionHeader('EDUCATION', paragraphs);
      for (const edu of data.education) {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: edu.degree,
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: `  —  ${edu.institution}`,
                size: 20,
                color: '334155',
              }),
              new TextRun({
                text: edu.year ? ` (${edu.year})` : '',
                italics: true,
                size: 18,
                color: '64748B',
              }),
            ],
          })
        );
      }
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      this.addSectionHeader('CERTIFICATIONS', paragraphs);
      for (const cert of data.certifications) {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: cert.name,
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: cert.issuer ? `  —  ${cert.issuer}` : '',
                size: 20,
                color: '334155',
              }),
              new TextRun({
                text: cert.year ? ` (${cert.year})` : '',
                italics: true,
                size: 18,
                color: '64748B',
              }),
            ],
          })
        );
      }
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      this.addSectionHeader('KEY PROJECTS', paragraphs);
      for (const proj of data.projects) {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({
                text: proj.name,
                bold: true,
                size: 20,
                color: '0F172A',
              }),
            ],
          })
        );
        paragraphs.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: proj.description,
                size: 20,
                color: '334155',
              }),
            ],
          })
        );
      }
    }
  }

  private buildGeneralDocument(options: DocxExportOptions, paragraphs: Paragraph[]) {
    // Header
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: options.candidateName || options.title,
            bold: true,
            size: 32,
            color: '0F172A',
          }),
        ],
      })
    );

    if (options.targetJobTitle || options.targetCompanyName) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `Application for ${options.targetJobTitle || 'Role'} at ${options.targetCompanyName || 'Company'}`,
              bold: true,
              color: '2563EB',
              size: 22,
            }),
          ],
        })
      );
    }

    if (options.documentType === 'APPLICATION_EMAIL' && options.subjectLine) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 150 },
          children: [
            new TextRun({
              text: 'Subject: ',
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: options.subjectLine,
              size: 20,
              color: '334155',
            }),
          ],
        })
      );
    }

    const lines = options.content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        paragraphs.push(new Paragraph({ spacing: { after: 80 } }));
        continue;
      }

      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: line.replace(/^#\s+/, ''),
                bold: true,
                size: 28,
                color: '0F172A',
              }),
            ],
          })
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 },
            children: [
              new TextRun({
                text: line.replace(/^##\s+/, ''),
                bold: true,
                size: 24,
                color: '2563EB',
              }),
            ],
          })
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: line.replace(/^###\s+/, ''),
                bold: true,
                size: 22,
                color: '0F172A',
              }),
            ],
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: line.replace(/^[-*•]\s+/, ''),
                size: 20,
                color: '334155',
              }),
            ],
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: line,
                size: 20,
                color: '334155',
              }),
            ],
          })
        );
      }
    }
  }

  private addSectionHeader(title: string, paragraphs: Paragraph[]) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 250, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            color: '2563EB',
            size: 22, // 11pt
          }),
        ],
      })
    );
  }
}

export const docxExporter = new DocxExporter();
