import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { profileService } from '../profile/profile.service';
import { googleDriveService } from '../documents/google-drive.service';
import { factualVerifier } from './factual-verifier';
import { aiDocumentGenerator } from './ai-document-generator.service';
import { pdfExporter } from './exporters/pdf.exporter';
import { docxExporter } from './exporters/docx.exporter';
import { textExporter } from './exporters/text.exporter';
import {
  GenerateDocumentInput,
  SaveVersionInput,
  AttachApplicationInput,
  ListDocumentsQuery,
} from './ai-documents.types';
import { DocumentType, Prisma } from '@prisma/client';

export class AiDocumentsService {
  /**
   * Generates a new tailored document draft grounded in candidate profile facts
   */
  async generateDocumentDraft(userId: string, input: GenerateDocumentInput) {
    // 1. Fetch Candidate Profile Facts
    const fullProfile = await profileService.getProfile(userId);
    const candidateFacts = factualVerifier.extractFactsFromProfile(fullProfile);

    // 2. Resolve Target Job Context
    let targetJob = {
      title: 'Target Position',
      companyName: 'Target Employer',
      description: '',
      location: '',
    };

    if (input.jobId) {
      const job = await prisma.job.findUnique({
        where: { id: input.jobId },
      });
      if (!job) {
        throw AppError.notFound('Target job listing not found');
      }
      targetJob = {
        title: job.normalizedTitle || job.originalTitle,
        companyName: job.companyName || 'Unknown Company',
        description: job.normalizedDescription || job.originalDescription,
        location: [job.city, job.country].filter(Boolean).join(', '),
      };
    } else if (input.externalJob) {
      targetJob = {
        title: input.externalJob.title,
        companyName: input.externalJob.companyName,
        description: input.externalJob.description || '',
        location: input.externalJob.location || '',
      };
    }

    // 3. Generate Content using AI / Heuristic Generator
    const generated = await aiDocumentGenerator.generate(
      input.documentType,
      candidateFacts,
      targetJob,
      input.customInstructions
    );

    // 4. Run Factual Grounding Verification
    const verificationReport = factualVerifier.verify(
      generated.content,
      generated.structuredData,
      candidateFacts,
      targetJob
    );

    // 5. Construct Document Title
    const typeLabel =
      input.documentType === 'TAILORED_CV'
        ? 'Tailored CV'
        : input.documentType === 'COVER_LETTER'
        ? 'Cover Letter'
        : 'Application Email';
    const title = `${typeLabel} - ${targetJob.title} (${targetJob.companyName})`;

    // 6. Save Initial Version in Database
    const document = await prisma.generatedDocument.create({
      data: {
        userId,
        documentType: input.documentType,
        title,
        jobId: input.jobId || null,
        targetJobTitle: targetJob.title,
        targetCompanyName: targetJob.companyName,
        targetJobDescription: targetJob.description || null,
        applicationId: input.applicationId || null,
        currentVersionNumber: 1,
        status: 'COMPLETED',
        versions: {
          create: {
            versionNumber: 1,
            content: generated.content,
            structuredData: generated.structuredData,
            subjectLine: generated.subjectLine,
            promptVersion: generated.promptVersion,
            modelIdentifier: generated.modelIdentifier,
            changeSummary: 'Initial AI generation draft',
          },
        },
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    return {
      document,
      verificationReport,
    };
  }

  /**
   * Lists generated documents belonging to the user with pagination and filtering
   */
  async listDocuments(userId: string, query: ListDocumentsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedDocumentWhereInput = {
      userId,
      ...(query.documentType && { documentType: query.documentType }),
      ...(query.jobId && { jobId: query.jobId }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search } },
          { targetJobTitle: { contains: query.search } },
          { targetCompanyName: { contains: query.search } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      prisma.generatedDocument.count({ where }),
      prisma.generatedDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
          job: {
            select: {
              id: true,
              originalTitle: true,
              companyName: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single generated document with full version history
   */
  async getDocumentById(userId: string, documentId: string) {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        job: {
          select: {
            id: true,
            originalTitle: true,
            companyName: true,
            city: true,
            country: true,
          },
        },
        application: {
          select: {
            id: true,
            status: true,
            jobTitle: true,
            companyName: true,
          },
        },
      },
    });

    if (!document) {
      throw AppError.notFound('Generated document not found');
    }

    if (document.userId !== userId) {
      throw AppError.forbidden('You do not have permission to access this document');
    }

    return document;
  }

  /**
   * Creates an updated version of a generated document
   */
  async saveEditedVersion(userId: string, documentId: string, input: SaveVersionInput) {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      throw AppError.notFound('Generated document not found');
    }

    if (document.userId !== userId) {
      throw AppError.forbidden('You do not have permission to edit this document');
    }

    const latestVersion = document.versions[0];
    const nextVersionNumber = (latestVersion?.versionNumber || document.currentVersionNumber) + 1;

    const newVersion = await prisma.generatedDocumentVersion.create({
      data: {
        documentId,
        versionNumber: nextVersionNumber,
        content: input.content,
        structuredData: (input.structuredData as any) ?? latestVersion?.structuredData ?? null,
        subjectLine: input.subjectLine ?? latestVersion?.subjectLine ?? null,
        promptVersion: latestVersion?.promptVersion || 'user-edited',
        modelIdentifier: latestVersion?.modelIdentifier || 'user-edited',
        changeSummary: input.changeSummary || `Updated version ${nextVersionNumber}`,
      },
    });

    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: {
        currentVersionNumber: nextVersionNumber,
        updatedAt: new Date(),
      },
    });

    return newVersion;
  }

  /**
   * Exports a document version to PDF, DOCX, or TXT
   */
  async exportDocumentFile(
    userId: string,
    documentId: string,
    versionNumber: number,
    format: 'pdf' | 'docx' | 'txt'
  ) {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw AppError.notFound('Generated document not found');
    }

    if (document.userId !== userId) {
      throw AppError.forbidden('You do not have permission to export this document');
    }

    const version = await prisma.generatedDocumentVersion.findUnique({
      where: {
        documentId_versionNumber: {
          documentId,
          versionNumber,
        },
      },
    });

    if (!version) {
      throw AppError.notFound(`Version ${versionNumber} not found for this document`);
    }

    const candidateName =
      [document.user.firstName, document.user.lastName].filter(Boolean).join(' ') ||
      document.user.profile?.displayName ||
      'Candidate';

    const safeCandidateName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeCompanyName = document.targetCompanyName.replace(/[^a-zA-Z0-9]/g, '_');
    const baseFilename = `${safeCandidateName}_${document.documentType}_${safeCompanyName}`;

    if (format === 'pdf') {
      const buffer = await pdfExporter.exportToBuffer({
        title: document.title,
        documentType: document.documentType,
        content: version.content,
        structuredData: version.structuredData,
        subjectLine: version.subjectLine,
        candidateName,
        targetJobTitle: document.targetJobTitle,
        targetCompanyName: document.targetCompanyName,
      });

      return {
        buffer,
        filename: `${baseFilename}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    if (format === 'docx') {
      const buffer = await docxExporter.exportToBuffer({
        title: document.title,
        documentType: document.documentType,
        content: version.content,
        structuredData: version.structuredData,
        subjectLine: version.subjectLine,
        candidateName,
        targetJobTitle: document.targetJobTitle,
        targetCompanyName: document.targetCompanyName,
      });

      return {
        buffer,
        filename: `${baseFilename}.docx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }

    // Default: TXT
    const buffer = textExporter.exportToBuffer(
      version.content,
      version.subjectLine,
      document.documentType
    );

    return {
      buffer,
      filename: `${baseFilename}.txt`,
      mimeType: 'text/plain; charset=utf-8',
    };
  }

  /**
   * Compiles the document to PDF, saves it as a UserDocument, and attaches it to a JobApplication
   */
  async attachToApplication(
    userId: string,
    documentId: string,
    input: AttachApplicationInput
  ) {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw AppError.notFound('Generated document not found');
    }

    if (document.userId !== userId) {
      throw AppError.forbidden('You do not have permission to attach this document');
    }

    const application = await prisma.jobApplication.findFirst({
      where: {
        id: input.applicationId,
        userId,
      },
    });

    if (!application) {
      throw AppError.notFound('Target job application not found or not owned by you');
    }

    const latestVersion = document.versions[0];
    if (!latestVersion) {
      throw AppError.badRequest('Document has no version content to attach');
    }

    const candidateName =
      [document.user.firstName, document.user.lastName].filter(Boolean).join(' ') ||
      document.user.profile?.displayName ||
      'Candidate';

    // 1. Compile latest version to PDF buffer
    const pdfBuffer = await pdfExporter.exportToBuffer({
      title: document.title,
      documentType: document.documentType,
      content: latestVersion.content,
      structuredData: latestVersion.structuredData,
      subjectLine: latestVersion.subjectLine,
      candidateName,
      targetJobTitle: document.targetJobTitle,
      targetCompanyName: document.targetCompanyName,
    });

    const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const filename = `${document.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    // 2. Upload file through storage service
    const driveUpload = await googleDriveService.uploadFile({
      buffer: pdfBuffer,
      filename: `${userId}_${Date.now()}_${filename}`,
      mimeType: 'application/pdf',
    });

    // 3. Create UserDocument record
    const userDocType =
      input.attachAs === 'CV' ? DocumentType.CV : DocumentType.COVER_LETTER;

    const userDocument = await prisma.userDocument.create({
      data: {
        userId,
        driveFileId: driveUpload.fileId,
        documentType: userDocType,
        originalFilename: filename,
        mimeType: 'application/pdf',
        fileSize: pdfBuffer.length,
        fileChecksum: checksum,
        storageProvider:
          driveUpload.storageProvider ||
          (googleDriveService.isLiveStorage ? 'GOOGLE_DRIVE' : 'LOCAL_STORAGE'),
        processingStatus: 'COMPLETED',
        extractionStatus: 'NOT_EXTRACTED',
      },
    });

    // 4. Update JobApplication with reference
    if (input.attachAs === 'CV') {
      await prisma.jobApplication.update({
        where: { id: input.applicationId },
        data: {
          documentId: userDocument.id,
          documentSnapshotFilename: filename,
          documentSnapshotChecksum: checksum,
        },
      });
    } else {
      await prisma.jobApplication.update({
        where: { id: input.applicationId },
        data: {
          coverLetterDocumentId: userDocument.id,
        },
      });
    }

    // 5. Update GeneratedDocument and version links
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: {
        applicationId: input.applicationId,
      },
    });

    await prisma.generatedDocumentVersion.update({
      where: { id: latestVersion.id },
      data: {
        compiledDocumentId: userDocument.id,
      },
    });

    return {
      success: true,
      userDocumentId: userDocument.id,
      applicationId: input.applicationId,
      attachedAs: input.attachAs,
    };
  }

  /**
   * Deletes a generated document draft
   */
  async deleteDocument(userId: string, documentId: string) {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw AppError.notFound('Generated document not found');
    }

    if (document.userId !== userId) {
      throw AppError.forbidden('You do not have permission to delete this document');
    }

    await prisma.generatedDocument.delete({
      where: { id: documentId },
    });

    return {
      success: true,
      message: 'Generated document deleted successfully',
    };
  }
}

export const aiDocumentsService = new AiDocumentsService();
