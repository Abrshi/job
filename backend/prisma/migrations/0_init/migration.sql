-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `role` ENUM('CANDIDATE', 'EMPLOYER', 'ADMIN') NOT NULL DEFAULT 'CANDIDATE',
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isRevoked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refresh_sessions_tokenHash_key`(`tokenHash`),
    INDEX `refresh_sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_sources` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `type` ENUM('API', 'RSS', 'SCRAPER') NOT NULL DEFAULT 'API',
    `endpointUrl` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `pollingInterval` INTEGER NOT NULL DEFAULT 60,
    `lastRunAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,
    `headers` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_sources_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `originalUrl` TEXT NOT NULL,
    `applicationUrl` TEXT NULL,
    `rawPayload` JSON NULL,
    `originalTitle` VARCHAR(191) NOT NULL,
    `originalDescription` LONGTEXT NOT NULL,
    `normalizedTitle` VARCHAR(191) NOT NULL,
    `normalizedDescription` LONGTEXT NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `isRemote` BOOLEAN NOT NULL DEFAULT false,
    `workArrangement` ENUM('ON_SITE', 'HYBRID', 'REMOTE') NOT NULL DEFAULT 'ON_SITE',
    `remoteEligibility` VARCHAR(191) NULL,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE') NULL,
    `experienceLevel` ENUM('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNSPECIFIED') NULL,
    `salaryMin` DECIMAL(12, 2) NULL,
    `salaryMax` DECIMAL(12, 2) NULL,
    `salaryCurrency` VARCHAR(191) NULL,
    `salaryPeriod` ENUM('HOURLY', 'MONTHLY', 'YEARLY') NULL,
    `publishedAt` DATETIME(3) NULL,
    `closingDate` DATETIME(3) NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiredAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `categoryId` VARCHAR(191) NULL,
    `classificationStatus` ENUM('PENDING', 'CLASSIFIED', 'FAILED', 'REVIEW_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `classificationConfidence` DECIMAL(4, 3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `jobs_sourceId_idx`(`sourceId`),
    INDEX `jobs_categoryId_idx`(`categoryId`),
    INDEX `jobs_status_idx`(`status`),
    INDEX `jobs_publishedAt_idx`(`publishedAt`),
    INDEX `jobs_externalId_idx`(`externalId`),
    UNIQUE INDEX `jobs_sourceId_fingerprint_key`(`sourceId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_classifications` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `predictedCategoryName` VARCHAR(191) NOT NULL,
    `predictedExperienceLevel` ENUM('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNSPECIFIED') NULL,
    `confidence` DECIMAL(4, 3) NOT NULL,
    `status` ENUM('AUTO_APPROVED', 'NEEDS_REVIEW', 'MANUALLY_REVIEWED', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `explanation` TEXT NULL,
    `extractedSkills` JSON NULL,
    `modelIdentifier` VARCHAR(191) NOT NULL,
    `promptVersion` VARCHAR(191) NOT NULL,
    `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_classifications_jobId_idx`(`jobId`),
    INDEX `job_classifications_isCurrent_idx`(`isCurrent`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_runs` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `recordsFetched` INTEGER NOT NULL DEFAULT 0,
    `jobsCreated` INTEGER NOT NULL DEFAULT 0,
    `jobsUpdated` INTEGER NOT NULL DEFAULT 0,
    `jobsSkipped` INTEGER NOT NULL DEFAULT 0,
    `errorSummary` TEXT NULL,
    `checkpoint` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `collection_runs_sourceId_idx`(`sourceId`),
    INDEX `collection_runs_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_sessions` ADD CONSTRAINT `refresh_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `job_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `job_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_classifications` ADD CONSTRAINT `job_classifications_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_classifications` ADD CONSTRAINT `job_classifications_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `job_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_runs` ADD CONSTRAINT `collection_runs_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `job_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

