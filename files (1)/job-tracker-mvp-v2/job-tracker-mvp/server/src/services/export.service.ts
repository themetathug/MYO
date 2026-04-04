import { pool } from '../database/client';
import { logger } from '../utils/logger';
import PDFDocument from 'pdfkit';

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'json';
  includeApplications?: boolean;
  includeColdEmails?: boolean;
  includeAnalytics?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class ExportService {
  /**
   * Export user data
   */
  async exportUserData(userId: string, options: ExportOptions): Promise<Buffer | string> {
    try {
      switch (options.format) {
        case 'csv':
          return await this.exportToCSV(userId, options);
        case 'pdf':
          return await this.exportToPDF(userId, options);
        case 'json':
          return await this.exportToJSON(userId, options);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Error exporting user data:', error);
      throw error;
    }
  }

  /**
   * Export to CSV
   */
  private async exportToCSV(userId: string, options: ExportOptions): Promise<string> {
    const csvRows: string[] = [];

    // Applications CSV
    if (options.includeApplications !== false) {
      const applications = await this.getApplications(userId, options.dateRange);
      
      // Header
      csvRows.push('Applications');
      csvRows.push('Company,Position,Location,Status,Applied Date,Time Spent (min),Job Board,Job URL');
      
      // Data
      for (const app of applications) {
        csvRows.push([
          this.escapeCSV(app.company),
          this.escapeCSV(app.position),
          this.escapeCSV(app.location || ''),
          this.escapeCSV(app.status),
          app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '',
          app.time_spent || 0,
          this.escapeCSV(app.job_board_source || ''),
          this.escapeCSV(app.job_url || ''),
        ].join(','));
      }
      
      csvRows.push(''); // Empty line
    }

    // Cold Emails CSV
    if (options.includeColdEmails) {
      const coldEmails = await this.getColdEmails(userId, options.dateRange);
      
      csvRows.push('Cold Emails');
      csvRows.push('Company,Contact Name,Email,Sent Date,Status,Response');
      
      for (const email of coldEmails) {
        csvRows.push([
          this.escapeCSV(email.company || ''),
          this.escapeCSV(email.contact_name || ''),
          this.escapeCSV(email.contact_email || ''),
          email.sent_at ? new Date(email.sent_at).toLocaleDateString() : '',
          this.escapeCSV(email.status || ''),
          this.escapeCSV(email.response_received ? 'Yes' : 'No'),
        ].join(','));
      }
      
      csvRows.push('');
    }

    // Analytics CSV
    if (options.includeAnalytics) {
      const analytics = await this.getAnalytics(userId, options.dateRange);
      
      csvRows.push('Analytics');
      csvRows.push('Metric,Value');
      csvRows.push(`Total Applications,${analytics.totalApplications}`);
      csvRows.push(`Response Rate,${(analytics.responseRate * 100).toFixed(2)}%`);
      csvRows.push(`Interview Rate,${(analytics.interviewRate * 100).toFixed(2)}%`);
      csvRows.push(`Average Time per Application,${analytics.avgTimePerApp} minutes`);
      csvRows.push(`Best Job Board,${analytics.bestJobBoard || 'N/A'}`);
    }

    return csvRows.join('\n');
  }

  /**
   * Export to PDF
   */
  private async exportToPDF(userId: string, options: ExportOptions): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('UK Job Tracker - Data Export', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Applications
        if (options.includeApplications !== false) {
          doc.fontSize(16).text('Applications', { underline: true });
          doc.moveDown();
          
          const applications = await this.getApplications(userId, options.dateRange);
          
          for (const app of applications) {
            doc.fontSize(12);
            doc.text(`${app.company} - ${app.position}`, { continued: false });
            doc.fontSize(10);
            doc.text(`Status: ${app.status} | Applied: ${app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'N/A'}`);
            doc.text(`Location: ${app.location || 'N/A'} | Time: ${app.time_spent || 0} min`);
            doc.moveDown(0.5);
          }
          
          doc.moveDown();
        }

        // Cold Emails
        if (options.includeColdEmails) {
          doc.fontSize(16).text('Cold Emails', { underline: true });
          doc.moveDown();
          
          const coldEmails = await this.getColdEmails(userId, options.dateRange);
          
          for (const email of coldEmails) {
            doc.fontSize(12);
            doc.text(`${email.company || 'N/A'} - ${email.contact_name || 'N/A'}`, { continued: false });
            doc.fontSize(10);
            doc.text(`Email: ${email.contact_email || 'N/A'} | Status: ${email.status || 'N/A'}`);
            doc.text(`Sent: ${email.sent_at ? new Date(email.sent_at).toLocaleDateString() : 'N/A'}`);
            doc.moveDown(0.5);
          }
          
          doc.moveDown();
        }

        // Analytics
        if (options.includeAnalytics) {
          doc.fontSize(16).text('Analytics Summary', { underline: true });
          doc.moveDown();
          
          const analytics = await this.getAnalytics(userId, options.dateRange);
          
          doc.fontSize(12);
          doc.text(`Total Applications: ${analytics.totalApplications}`);
          doc.text(`Response Rate: ${(analytics.responseRate * 100).toFixed(2)}%`);
          doc.text(`Interview Rate: ${(analytics.interviewRate * 100).toFixed(2)}%`);
          doc.text(`Average Time per Application: ${analytics.avgTimePerApp} minutes`);
          doc.text(`Best Job Board: ${analytics.bestJobBoard || 'N/A'}`);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export to JSON
   */
  private async exportToJSON(userId: string, options: ExportOptions): Promise<string> {
    const data: any = {
      exportDate: new Date().toISOString(),
      userId,
    };

    if (options.includeApplications !== false) {
      data.applications = await this.getApplications(userId, options.dateRange);
    }

    if (options.includeColdEmails) {
      data.coldEmails = await this.getColdEmails(userId, options.dateRange);
    }

    if (options.includeAnalytics) {
      data.analytics = await this.getAnalytics(userId, options.dateRange);
    }

    return JSON.stringify(data, null, 2);
  }

  // Helper methods
  private async getApplications(userId: string, dateRange?: { start: Date; end: Date }) {
    let query = `SELECT * FROM applications WHERE user_id = $1`;
    const params: any[] = [userId];

    if (dateRange) {
      query += ` AND applied_at >= $2 AND applied_at <= $3`;
      params.push(dateRange.start, dateRange.end);
    }

    query += ` ORDER BY applied_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  private async getColdEmails(userId: string, dateRange?: { start: Date; end: Date }) {
    let query = `SELECT * FROM cold_emails WHERE user_id = $1`;
    const params: any[] = [userId];

    if (dateRange) {
      query += ` AND sent_at >= $2 AND sent_at <= $3`;
      params.push(dateRange.start, dateRange.end);
    }

    query += ` ORDER BY sent_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  private async getAnalytics(userId: string, dateRange?: { start: Date; end: Date }) {
    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status != 'APPLIED')::float / NULLIF(COUNT(*), 0) as response_rate,
        COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED', 'INTERVIEWED'))::float / NULLIF(COUNT(*), 0) as interview_rate,
        AVG(time_spent) as avg_time,
        MODE() WITHIN GROUP (ORDER BY job_board_source) as best_board
      FROM applications
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (dateRange) {
      query += ` AND applied_at >= $2 AND applied_at <= $3`;
      params.push(dateRange.start, dateRange.end);
    }

    const result = await pool.query(query, params);
    const row = result.rows[0];

    return {
      totalApplications: parseInt(row.total || 0),
      responseRate: parseFloat(row.response_rate || 0),
      interviewRate: parseFloat(row.interview_rate || 0),
      avgTimePerApp: Math.round(parseFloat(row.avg_time || 0)),
      bestJobBoard: row.best_board || null,
    };
  }

  private escapeCSV(value: string): string {
    if (!value) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }
}
