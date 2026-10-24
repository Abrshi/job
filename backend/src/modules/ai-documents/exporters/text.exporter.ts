import { GeneratedDocumentType } from '@prisma/client';

export class TextExporter {
  exportToBuffer(content: string, subjectLine?: string | null, documentType?: GeneratedDocumentType): Buffer {
    let output = '';

    if (documentType === 'APPLICATION_EMAIL' && subjectLine) {
      output += `Subject: ${subjectLine}\n\n`;
    }

    output += content.trim() + '\n';
    return Buffer.from(output, 'utf-8');
  }
}

export const textExporter = new TextExporter();
