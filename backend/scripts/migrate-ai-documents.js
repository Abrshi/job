const mysql = require('../node_modules/mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || 'mysql://root:gyam@localhost:3306/job');
  console.log('Applying database migration for AI-Powered Application Documents...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS generated_documents (
      id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      document_type ENUM('TAILORED_CV', 'COVER_LETTER', 'APPLICATION_EMAIL') NOT NULL,
      title VARCHAR(255) NOT NULL,
      job_id VARCHAR(191) NULL,
      target_job_title VARCHAR(255) NOT NULL,
      target_company_name VARCHAR(255) NOT NULL,
      target_job_description TEXT NULL,
      application_id VARCHAR(191) NULL,
      current_version_number INT NOT NULL DEFAULT 1,
      status ENUM('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
      failure_reason TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX generated_documents_user_id_idx (user_id),
      INDEX generated_documents_job_id_idx (job_id),
      INDEX generated_documents_application_id_idx (application_id),
      INDEX generated_documents_document_type_idx (document_type),
      CONSTRAINT generated_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT generated_documents_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT generated_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS generated_document_versions (
      id VARCHAR(191) NOT NULL,
      document_id VARCHAR(191) NOT NULL,
      version_number INT NOT NULL,
      content LONGTEXT NOT NULL,
      structured_data JSON NULL,
      subject_line VARCHAR(500) NULL,
      prompt_version VARCHAR(50) NOT NULL,
      model_identifier VARCHAR(100) NOT NULL,
      change_summary VARCHAR(255) NULL,
      compiled_document_id VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX generated_document_versions_document_id_version_number_key (document_id, version_number),
      INDEX generated_document_versions_document_id_idx (document_id),
      CONSTRAINT generated_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES generated_documents (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT generated_document_versions_compiled_document_id_fkey FOREIGN KEY (compiled_document_id) REFERENCES user_documents (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  console.log('AI-Powered Application Documents tables created successfully.');
  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
