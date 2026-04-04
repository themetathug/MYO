import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export class EmailSenderService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter() {
    try {
      // Use environment variables for email configuration
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      };

      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        logger.warn('⚠️ Email credentials not configured - email sending disabled');
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      logger.info('✅ Email transporter initialized');
    } catch (error) {
      logger.error('Error initializing email transporter:', error);
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not initialized - skipping email send');
        return false;
      }

      const mailOptions = {
        from: options.from || process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html || ''),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send status update email
   */
  async sendStatusUpdateEmail(
    to: string,
    company: string,
    position: string,
    oldStatus: string,
    newStatus: string
  ): Promise<boolean> {
    const subject = `Application Update: ${company} - ${position}`;
    const html = `
      <h2>Application Status Updated</h2>
      <p>Your application status has been updated:</p>
      <ul>
        <li><strong>Company:</strong> ${company}</li>
        <li><strong>Position:</strong> ${position}</li>
        <li><strong>Previous Status:</strong> ${oldStatus}</li>
        <li><strong>New Status:</strong> ${newStatus}</li>
      </ul>
      <p>View your dashboard to see more details.</p>
    `;

    return await this.sendEmail({ to, subject, html });
  }

  /**
   * Send ghosting notification email
   */
  async sendGhostingNotificationEmail(
    to: string,
    company: string,
    position: string,
    daysSinceApplication: number
  ): Promise<boolean> {
    const subject = `Application Update: ${company} - ${position}`;
    const html = `
      <h2>Application May Be Ghosted</h2>
      <p>It's been ${daysSinceApplication} days since you applied to:</p>
      <ul>
        <li><strong>Company:</strong> ${company}</li>
        <li><strong>Position:</strong> ${position}</li>
      </ul>
      <p>Consider following up or moving on to other opportunities.</p>
    `;

    return await this.sendEmail({ to, subject, html });
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        return false;
      }
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return false;
    }
  }
}
