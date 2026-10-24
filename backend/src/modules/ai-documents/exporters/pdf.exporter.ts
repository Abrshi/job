import PDFDocument from 'pdfkit';
import { GeneratedDocumentType, StructuredCvData } from '../ai-documents.types';

export interface PdfExportOptions {
  title: string;
  documentType: GeneratedDocumentType;
  content: string;
  structuredData?: any;
  subjectLine?: string | null;
  candidateName?: string;
  targetJobTitle?: string;
  targetCompanyName?: string;
}

export class PdfExporter {
  async exportToBuffer(options: PdfExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 48, bottom: 54, left: 54, right: 54 },
          bufferPages: true,
          info: {
            Title: options.title,
            Author: options.candidateName || 'Candidate',
            Subject: `${options.documentType} for ${options.targetJobTitle || 'Job Application'}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Colors
        const primaryColor = '#0F172A'; // Slate 900
        const secondaryColor = '#2563EB'; // Blue 600
        const textColor = '#334155'; // Slate 700
        const mutedColor = '#64748B'; // Slate 500
        const dividerColor = '#CBD5E1'; // Slate 300

        // If structured CV data is present, render structured layout
        if (options.documentType === 'TAILORED_CV' && options.structuredData?.header) {
          this.renderStructuredCv(doc, options.structuredData as StructuredCvData, {
            primaryColor,
            secondaryColor,
            textColor,
            mutedColor,
            dividerColor,
          });
        } else {
          // Render markdown / general layout
          this.renderGeneralDocument(doc, options, {
            primaryColor,
            secondaryColor,
            textColor,
            mutedColor,
            dividerColor,
          });
        }

        // Apply footers to all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).fillColor(mutedColor);
          doc.text(
            'Draft prepared for candidate review • Generated on Starcher Platform',
            54,
            doc.page.height - 35,
            { align: 'left', width: doc.page.width - 108 }
          );
          doc.text(
            `Page ${i + 1} of ${pages.count}`,
            54,
            doc.page.height - 35,
            { align: 'right', width: doc.page.width - 108 }
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderStructuredCv(
    doc: PDFKit.PDFDocument,
    data: StructuredCvData,
    colors: Record<string, string>
  ) {
    // Header
    const name = data.header.fullName || 'Candidate Name';
    doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.primaryColor).text(name, { align: 'center' });

    if (data.header.headline) {
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica').fillColor(colors.secondaryColor).text(data.header.headline, { align: 'center' });
    }

    // Contact info row
    const contactParts = [
      data.header.email,
      data.header.phone,
      data.header.location,
    ].filter(Boolean);

    if (contactParts.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor(colors.mutedColor).text(contactParts.join('  •  '), { align: 'center' });
    }

    // Divider
    doc.moveDown(0.6);
    this.drawHorizontalRule(doc, colors.dividerColor);
    doc.moveDown(0.6);

    // Professional Summary
    if (data.professionalSummary) {
      this.drawSectionHeader(doc, 'PROFESSIONAL SUMMARY', colors.secondaryColor, colors.dividerColor);
      doc.fontSize(9.5).font('Helvetica').fillColor(colors.textColor).text(data.professionalSummary, {
        lineGap: 3,
        align: 'justify',
      });
      doc.moveDown(0.8);
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      this.drawSectionHeader(doc, 'CORE SKILLS & EXPERTISE', colors.secondaryColor, colors.dividerColor);
      for (const group of data.skills) {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(colors.primaryColor).text(`${group.category}: `, {
          continued: true,
        });
        doc.font('Helvetica').fillColor(colors.textColor).text(group.items.join(', '));
        doc.moveDown(0.2);
      }
      doc.moveDown(0.6);
    }

    // Work Experience
    if (data.experience && data.experience.length > 0) {
      this.drawSectionHeader(doc, 'WORK EXPERIENCE', colors.secondaryColor, colors.dividerColor);
      for (const item of data.experience) {
        // Title & Period
        doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primaryColor).text(item.title, { continued: true });
        doc.font('Helvetica-Oblique').fillColor(colors.mutedColor).text(`  •  ${item.company}`, { continued: true });
        if (item.period) {
          doc.font('Helvetica').fillColor(colors.mutedColor).text(` (${item.period})`, { align: 'left' });
        } else {
          doc.text('');
        }

        // Bullets
        if (item.bullets && item.bullets.length > 0) {
          for (const bullet of item.bullets) {
            doc.fontSize(9).font('Helvetica').fillColor(colors.textColor);
            doc.text('•  ', { indent: 10, continued: true });
            doc.text(bullet, { lineGap: 2 });
          }
        }
        doc.moveDown(0.5);
      }
      doc.moveDown(0.4);
    }

    // Education
    if (data.education && data.education.length > 0) {
      this.drawSectionHeader(doc, 'EDUCATION', colors.secondaryColor, colors.dividerColor);
      for (const edu of data.education) {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(colors.primaryColor).text(edu.degree, { continued: true });
        doc.font('Helvetica').fillColor(colors.textColor).text(`  —  ${edu.institution}`, { continued: Boolean(edu.year) });
        if (edu.year) {
          doc.font('Helvetica-Oblique').fillColor(colors.mutedColor).text(` (${edu.year})`);
        } else {
          doc.text('');
        }
        doc.moveDown(0.3);
      }
      doc.moveDown(0.4);
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      this.drawSectionHeader(doc, 'CERTIFICATIONS', colors.secondaryColor, colors.dividerColor);
      for (const cert of data.certifications) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.primaryColor).text(cert.name, { continued: Boolean(cert.issuer) });
        if (cert.issuer) {
          doc.font('Helvetica').fillColor(colors.textColor).text(`  —  ${cert.issuer}`, { continued: Boolean(cert.year) });
        }
        if (cert.year) {
          doc.font('Helvetica-Oblique').fillColor(colors.mutedColor).text(` (${cert.year})`);
        } else {
          doc.text('');
        }
        doc.moveDown(0.2);
      }
      doc.moveDown(0.4);
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      this.drawSectionHeader(doc, 'KEY PROJECTS', colors.secondaryColor, colors.dividerColor);
      for (const proj of data.projects) {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(colors.primaryColor).text(proj.name);
        doc.fontSize(9).font('Helvetica').fillColor(colors.textColor).text(proj.description, { lineGap: 2 });
        if (proj.technologies && proj.technologies.length > 0) {
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(colors.mutedColor).text(`Technologies: ${proj.technologies.join(', ')}`);
        }
        doc.moveDown(0.3);
      }
    }
  }

  private renderGeneralDocument(
    doc: PDFKit.PDFDocument,
    options: PdfExportOptions,
    colors: Record<string, string>
  ) {
    // Top Title
    const headerTitle = options.candidateName || options.title;
    doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.primaryColor).text(headerTitle);

    if (options.targetJobTitle || options.targetCompanyName) {
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica').fillColor(colors.secondaryColor).text(
        `Application for ${options.targetJobTitle || 'Role'} at ${options.targetCompanyName || 'Company'}`
      );
    }

    if (options.documentType === 'APPLICATION_EMAIL' && options.subjectLine) {
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primaryColor).text(`Subject: `, { continued: true });
      doc.font('Helvetica').fillColor(colors.textColor).text(options.subjectLine);
    }

    doc.moveDown(0.6);
    this.drawHorizontalRule(doc, colors.dividerColor);
    doc.moveDown(0.6);

    // Parse plain markdown lines
    const lines = options.content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        doc.moveDown(0.3);
        continue;
      }

      if (line.startsWith('# ')) {
        doc.moveDown(0.4);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primaryColor).text(line.replace(/^#\s+/, ''));
        doc.moveDown(0.2);
      } else if (line.startsWith('## ')) {
        doc.moveDown(0.4);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.secondaryColor).text(line.replace(/^##\s+/, ''));
        doc.moveDown(0.2);
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.3);
        doc.fontSize(10.5).font('Helvetica-Bold').fillColor(colors.primaryColor).text(line.replace(/^###\s+/, ''));
        doc.moveDown(0.1);
      } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        const bulletText = line.replace(/^[-*•]\s+/, '');
        doc.fontSize(9.5).font('Helvetica').fillColor(colors.textColor);
        doc.text('•  ', { indent: 12, continued: true });
        doc.text(bulletText, { lineGap: 2.5 });
      } else {
        doc.fontSize(9.5).font('Helvetica').fillColor(colors.textColor).text(line, {
          lineGap: 3,
        });
      }
    }
  }

  private drawSectionHeader(
    doc: PDFKit.PDFDocument,
    title: string,
    accentColor: string,
    dividerColor: string
  ) {
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(accentColor).text(title, { characterSpacing: 0.5 });
    doc.moveDown(0.2);
    const y = doc.y;
    doc
      .strokeColor(dividerColor)
      .lineWidth(0.75)
      .moveTo(54, y)
      .lineTo(doc.page.width - 54, y)
      .stroke();
    doc.moveDown(0.4);
  }

  private drawHorizontalRule(doc: PDFKit.PDFDocument, color: string) {
    const y = doc.y;
    doc
      .strokeColor(color)
      .lineWidth(0.75)
      .moveTo(54, y)
      .lineTo(doc.page.width - 54, y)
      .stroke();
  }
}

export const pdfExporter = new PdfExporter();
