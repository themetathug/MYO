/**
 * Status Detection Service Tests
 */

import { StatusDetectionService } from '../../services/status-detection.service';

describe('StatusDetectionService', () => {
  let service: StatusDetectionService;

  beforeEach(() => {
    service = new StatusDetectionService();
  });

  describe('detectStatus', () => {
    it('should detect REJECTED status', () => {
      const result = service.detectStatus(
        'Application Update',
        'Unfortunately, we have decided not to move forward with your application.'
      );

      expect(result.status).toBe('REJECTED');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect INTERVIEW_SCHEDULED status', () => {
      const result = service.detectStatus(
        'Interview Invitation',
        'We would like to schedule an interview with you on Monday, January 15th at 2 PM.'
      );

      expect(result.status).toBe('INTERVIEW_SCHEDULED');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect OFFERED status', () => {
      const result = service.detectStatus(
        'Job Offer',
        'We are pleased to offer you the position of Software Engineer.'
      );

      expect(result.status).toBe('OFFERED');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should return APPLIED for ambiguous emails', () => {
      const result = service.detectStatus(
        'Thank you for your application',
        'We have received your application and will review it shortly.'
      );

      expect(result.status).toBe('APPLIED');
    });
  });

  describe('extractCompanyDomain', () => {
    it('should extract domain from email', () => {
      const domain = service.extractCompanyDomain('recruiter@company.com');
      expect(domain).toBe('company.com');
    });

    it('should handle email with name', () => {
      const domain = service.extractCompanyDomain('John Doe <john@example.com>');
      expect(domain).toBe('example.com');
    });
  });
});
