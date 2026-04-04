import { logger } from '../utils/logger';
import { pool } from '../database/client';
import { StatusDetectionService } from './status-detection.service';

export interface CompanyContact {
  company: string;
  domain: string;
  emailAddresses: string[];
  verified: boolean;
  lastContactDate?: Date;
  contactCount: number;
}

export class CompanyContactsAutoService {
  private statusDetector: StatusDetectionService;

  constructor() {
    this.statusDetector = new StatusDetectionService();
  }

  /**
   * Auto-extract company contacts from emails
   */
  async extractFromEmails(userId: string): Promise<number> {
    try {
      // Get all emails from status updates
      const result = await pool.query(
        `SELECT DISTINCT
           email_from,
           email_domain,
           a.company
         FROM email_status_updates esu
         JOIN applications a ON a.id = esu.application_id
         WHERE esu.user_id = $1
           AND esu.email_from IS NOT NULL
           AND esu.created_at >= NOW() - INTERVAL '90 days'`,
        [userId]
      );

      let extractedCount = 0;

      for (const row of result.rows) {
        const domain = row.email_domain || this.statusDetector.extractCompanyDomain(row.email_from);
        const company = row.company;

        if (!domain || !company) continue;

        // Check if contact already exists
        const existing = await pool.query(
          `SELECT id FROM company_contacts 
           WHERE user_id = $1 AND domain = $2`,
          [userId, domain]
        );

        if (existing.rows.length > 0) {
          // Update existing contact
          await pool.query(
            `UPDATE company_contacts 
             SET email_addresses = array_append(COALESCE(email_addresses, ARRAY[]::VARCHAR[]), $1),
                 last_contact_date = NOW(),
                 contact_count = contact_count + 1,
                 updated_at = NOW()
             WHERE user_id = $2 AND domain = $3
               AND NOT ($1 = ANY(COALESCE(email_addresses, ARRAY[]::VARCHAR[])))`,
            [row.email_from, userId, domain]
          );
        } else {
          // Create new contact
          await pool.query(
            `INSERT INTO company_contacts 
             (user_id, company, domain, email_addresses, verified, last_contact_date, contact_count, created_at, updated_at)
             VALUES ($1, $2, $3, ARRAY[$4], false, NOW(), 1, NOW(), NOW())`,
            [userId, company, domain, row.email_from]
          );
          extractedCount++;
        }
      }

      logger.info(`✅ Auto-extracted ${extractedCount} new company contacts for user ${userId}`);
      return extractedCount;
    } catch (error) {
      logger.error('Error auto-extracting company contacts:', error);
      return 0;
    }
  }

  /**
   * Auto-verify company domains based on email history
   */
  async autoVerifyDomains(userId: string): Promise<number> {
    try {
      // Verify domains that have multiple email contacts
      const result = await pool.query(
        `UPDATE company_contacts 
         SET verified = true,
             updated_at = NOW()
         WHERE user_id = $1
           AND verified = false
           AND contact_count >= 3
           AND last_contact_date >= NOW() - INTERVAL '30 days'
         RETURNING id`,
        [userId]
      );

      const verifiedCount = result.rows.length;
      logger.info(`✅ Auto-verified ${verifiedCount} company domains for user ${userId}`);
      return verifiedCount;
    } catch (error) {
      logger.error('Error auto-verifying domains:', error);
      return 0;
    }
  }

  /**
   * Track email history per company
   */
  async trackEmailHistory(userId: string, companyDomain: string, emailData: {
    subject: string;
    from: string;
    date: Date;
    status?: string;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO company_email_history 
         (user_id, company_domain, email_subject, email_from, email_date, detected_status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          companyDomain,
          emailData.subject,
          emailData.from,
          emailData.date,
          emailData.status || null,
        ]
      );

      // Update last contact date in company_contacts
      await pool.query(
        `UPDATE company_contacts 
         SET last_contact_date = $1,
             contact_count = contact_count + 1,
             updated_at = NOW()
         WHERE user_id = $2 AND domain = $3`,
        [emailData.date, userId, companyDomain]
      );
    } catch (error) {
      logger.error('Error tracking email history:', error);
    }
  }

  /**
   * Get email history for a company
   */
  async getEmailHistory(userId: string, companyDomain: string): Promise<Array<{
    subject: string;
    from: string;
    date: Date;
    status?: string;
  }>> {
    try {
      const result = await pool.query(
        `SELECT 
           email_subject,
           email_from,
           email_date,
           detected_status
         FROM company_email_history
         WHERE user_id = $1 AND company_domain = $2
         ORDER BY email_date DESC
         LIMIT 50`,
        [userId, companyDomain]
      );

      return result.rows.map(row => ({
        subject: row.email_subject,
        from: row.email_from,
        date: row.email_date,
        status: row.detected_status,
      }));
    } catch (error) {
      logger.error('Error getting email history:', error);
      return [];
    }
  }

  /**
   * Import contacts from existing applications
   */
  async importFromApplications(userId: string): Promise<number> {
    try {
      // Get unique company domains from applications
      const result = await pool.query(
        `SELECT DISTINCT
           company,
           company_domain
         FROM applications
         WHERE user_id = $1
           AND company_domain IS NOT NULL
           AND company_domain != ''`,
        [userId]
      );

      let importedCount = 0;

      for (const row of result.rows) {
        // Check if contact already exists
        const existing = await pool.query(
          `SELECT id FROM company_contacts 
           WHERE user_id = $1 AND domain = $2`,
          [userId, row.company_domain]
        );

        if (existing.rows.length === 0) {
          // Create new contact
          await pool.query(
            `INSERT INTO company_contacts 
             (user_id, company, domain, verified, created_at, updated_at)
             VALUES ($1, $2, $3, false, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            [userId, row.company, row.company_domain]
          );
          importedCount++;
        }
      }

      logger.info(`✅ Imported ${importedCount} company contacts from applications for user ${userId}`);
      return importedCount;
    } catch (error) {
      logger.error('Error importing contacts from applications:', error);
      return 0;
    }
  }

  /**
   * Get all company contacts with email history
   */
  async getAllContacts(userId: string): Promise<CompanyContact[]> {
    try {
      const result = await pool.query(
        `SELECT 
           company,
           domain,
           email_addresses,
           verified,
           last_contact_date,
           contact_count
         FROM company_contacts
         WHERE user_id = $1
         ORDER BY last_contact_date DESC NULLS LAST, contact_count DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        company: row.company,
        domain: row.domain,
        emailAddresses: row.email_addresses || [],
        verified: row.verified,
        lastContactDate: row.last_contact_date,
        contactCount: parseInt(row.contact_count || 0),
      }));
    } catch (error) {
      logger.error('Error getting company contacts:', error);
      return [];
    }
  }
}
