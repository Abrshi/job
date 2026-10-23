const mysql = require('../node_modules/mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection('mysql://root:gyam@localhost:3306/job');
  console.log('Applying database migration for Application Tracking...');

  await conn.execute('DROP TABLE IF EXISTS job_application_reminders');
  await conn.execute('DROP TABLE IF EXISTS job_application_interviews');
  await conn.execute('DROP TABLE IF EXISTS job_application_histories');
  await conn.execute('DROP TABLE IF EXISTS job_applications');

  await conn.execute(`
    CREATE TABLE job_applications (
      id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      job_id VARCHAR(191) NULL,
      source ENUM('PLATFORM', 'EXTERNAL') NOT NULL DEFAULT 'PLATFORM',
      status ENUM('DRAFT', 'APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'APPLIED',
      job_title VARCHAR(255) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      job_url VARCHAR(1000) NULL,
      location VARCHAR(255) NULL,
      salary VARCHAR(100) NULL,
      applied_at DATETIME(3) NULL,
      document_id VARCHAR(191) NULL,
      document_snapshot_filename VARCHAR(255) NULL,
      document_snapshot_checksum VARCHAR(64) NULL,
      cover_note TEXT NULL,
      cover_letter_document_id VARCHAR(191) NULL,
      notes TEXT NULL,
      is_archived TINYINT(1) NOT NULL DEFAULT 0,
      active_key VARCHAR(255) NULL UNIQUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX job_applications_user_id_idx (user_id),
      INDEX job_applications_job_id_idx (job_id),
      INDEX job_applications_status_idx (status),
      INDEX job_applications_source_idx (source),
      INDEX job_applications_applied_at_idx (applied_at),
      INDEX job_applications_is_archived_idx (is_archived),
      CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT job_applications_document_id_fkey FOREIGN KEY (document_id) REFERENCES user_documents (id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT job_applications_cover_letter_document_id_fkey FOREIGN KEY (cover_letter_document_id) REFERENCES user_documents (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE job_application_histories (
      id VARCHAR(191) NOT NULL,
      application_id VARCHAR(191) NOT NULL,
      from_status ENUM('DRAFT', 'APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN') NULL,
      to_status ENUM('DRAFT', 'APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN') NOT NULL,
      reason VARCHAR(500) NULL,
      changed_by_user_id VARCHAR(191) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX job_application_histories_application_id_idx (application_id),
      INDEX job_application_histories_created_at_idx (created_at),
      CONSTRAINT job_application_histories_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE job_application_interviews (
      id VARCHAR(191) NOT NULL,
      application_id VARCHAR(191) NOT NULL,
      round_number INT NOT NULL DEFAULT 1,
      title VARCHAR(255) NOT NULL,
      interview_type ENUM('PHONE', 'VIDEO', 'IN_PERSON', 'TAKE_HOME', 'OTHER') NOT NULL DEFAULT 'VIDEO',
      scheduled_at DATETIME(3) NOT NULL,
      timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
      duration_minutes INT NULL DEFAULT 60,
      location_url VARCHAR(1000) NULL,
      interviewer_info VARCHAR(500) NULL,
      preparation_notes TEXT NULL,
      feedback_notes TEXT NULL,
      outcome ENUM('PENDING', 'PASSED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX job_application_interviews_application_id_idx (application_id),
      INDEX job_application_interviews_scheduled_at_idx (scheduled_at),
      INDEX job_application_interviews_outcome_idx (outcome),
      CONSTRAINT job_application_interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE job_application_reminders (
      id VARCHAR(191) NOT NULL,
      application_id VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      remind_at DATETIME(3) NOT NULL,
      is_completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME(3) NULL,
      notes TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX job_application_reminders_application_id_idx (application_id),
      INDEX job_application_reminders_remind_at_idx (remind_at),
      INDEX job_application_reminders_is_completed_idx (is_completed),
      CONSTRAINT job_application_reminders_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  console.log('Migration executed successfully! Checking tables...');
  const [tables] = await conn.execute('SHOW TABLES');
  console.log('Tables:', tables.map(t => Object.values(t)[0]));
  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
