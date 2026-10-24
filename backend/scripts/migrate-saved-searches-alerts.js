const mysql = require('../node_modules/mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection('mysql://root:gyam@localhost:3306/job');
  console.log('Applying database migration for Saved Searches & Job Alerts...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      search VARCHAR(255) NULL,
      category_slug VARCHAR(100) NULL,
      city VARCHAR(100) NULL,
      country VARCHAR(100) NULL,
      work_arrangement ENUM('ON_SITE', 'HYBRID', 'REMOTE') NULL,
      remote_eligibility VARCHAR(255) NULL,
      employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE') NULL,
      experience_level ENUM('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNSPECIFIED') NULL,
      min_salary DECIMAL(12, 2) NULL,
      max_salary DECIMAL(12, 2) NULL,
      currency VARCHAR(10) NULL DEFAULT 'ETB',
      is_alert_enabled TINYINT(1) NOT NULL DEFAULT 1,
      last_run_at DATETIME(3) NULL,
      last_alert_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX saved_searches_user_id_idx (user_id),
      INDEX saved_searches_is_alert_enabled_idx (is_alert_enabled),
      CONSTRAINT saved_searches_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS job_notifications (
      id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      job_id VARCHAR(191) NOT NULL,
      saved_search_id VARCHAR(191) NULL,
      matched_search_names JSON NULL,
      channel ENUM('IN_APP', 'EMAIL') NOT NULL DEFAULT 'IN_APP',
      status ENUM('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'DELIVERED',
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX job_notifications_user_id_job_id_key (user_id, job_id),
      INDEX job_notifications_user_id_is_read_idx (user_id, is_read),
      INDEX job_notifications_user_id_created_at_idx (user_id, created_at),
      INDEX job_notifications_job_id_idx (job_id),
      INDEX job_notifications_saved_search_id_idx (saved_search_id),
      CONSTRAINT job_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT job_notifications_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT job_notifications_saved_search_id_fkey FOREIGN KEY (saved_search_id) REFERENCES saved_searches (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  console.log('Saved Searches & Job Alerts tables created successfully.');
  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
