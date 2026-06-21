import { Role } from '@prisma/client';
import { MetricsService } from './metrics.service';

const manager = { userId: 'mgr-1', email: 'mgr@test.com', role: Role.MANAGER, name: 'Maria' };
const sales   = { userId: 'sales-1', email: 'sales@test.com', role: Role.SALES, name: 'Sara' };

describe('MetricsService', () => {
  let service: MetricsService;
  let repository: {
    getStatusCountsByDayMonth: jest.Mock;
    getStatusCountsForDate: jest.Mock;
    getDaysInMonth: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      getStatusCountsByDayMonth: jest.fn(),
      getStatusCountsForDate: jest.fn(),
      getDaysInMonth: jest.fn(),
    };
    service = new MetricsService({} as any, repository as any);
  });

  // ── getDailyStatusTrend ────────────────────────────────────────────────────

  describe('getDailyStatusTrend', () => {
    it('returns zeroed days when no audit events exist for the month', async () => {
      repository.getDaysInMonth.mockReturnValue([
        new Date('2026-06-01'),
        new Date('2026-06-02'),
        new Date('2026-06-03'),
      ]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([]);

      const result = await service.getDailyStatusTrend('2026-06', manager);

      expect(result.month).toBe('2026-06');
      expect(result.days).toHaveLength(3);
      expect(result.days[0]).toEqual({
        date: '2026-06-01',
        SUBMITTED: 0, APPROVED: 0, REJECTED: 0, INVOICED: 0,
      });
    });

    it('fills in actual counts for days that have events', async () => {
      repository.getDaysInMonth.mockReturnValue([
        new Date('2026-06-01'),
        new Date('2026-06-02'),
      ]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([
        { date: '2026-06-01', toStatus: 'SUBMITTED', count: BigInt(3) },
        { date: '2026-06-01', toStatus: 'APPROVED',  count: BigInt(1) },
        { date: '2026-06-02', toStatus: 'INVOICED',  count: BigInt(2) },
      ]);

      const result = await service.getDailyStatusTrend('2026-06', manager);

      expect(result.days[0]).toEqual({
        date: '2026-06-01', SUBMITTED: 3, APPROVED: 1, REJECTED: 0, INVOICED: 0,
      });
      expect(result.days[1]).toEqual({
        date: '2026-06-02', SUBMITTED: 0, APPROVED: 0, REJECTED: 0, INVOICED: 2,
      });
    });

    it('unknown statuses in results are ignored without throwing', async () => {
      repository.getDaysInMonth.mockReturnValue([new Date('2026-06-01')]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([
        { date: '2026-06-01', toStatus: 'DRAFT', count: BigInt(5) }, // ignored
        { date: '2026-06-01', toStatus: 'SUBMITTED', count: BigInt(2) },
      ]);

      const result = await service.getDailyStatusTrend('2026-06', manager);

      expect(result.days[0].SUBMITTED).toBe(2);
      expect(result.days[0].APPROVED).toBe(0);
    });

    it('returns days sorted ascending by date', async () => {
      repository.getDaysInMonth.mockReturnValue([
        new Date('2026-06-01'), new Date('2026-06-02'), new Date('2026-06-03'),
      ]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([
        { date: '2026-06-03', toStatus: 'SUBMITTED', count: BigInt(1) },
        { date: '2026-06-01', toStatus: 'APPROVED',  count: BigInt(2) },
      ]);

      const result = await service.getDailyStatusTrend('2026-06', manager);

      expect(result.days[0].date).toBe('2026-06-01');
      expect(result.days[2].date).toBe('2026-06-03');
    });

    it('passes isSalesUser=true and userId to repository for Sales role', async () => {
      repository.getDaysInMonth.mockReturnValue([new Date('2026-06-01')]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([]);

      await service.getDailyStatusTrend('2026-06', sales);

      expect(repository.getStatusCountsByDayMonth).toHaveBeenCalledWith(
        2026, 6, sales.userId, true,
      );
    });

    it('passes isSalesUser=false for Manager role', async () => {
      repository.getDaysInMonth.mockReturnValue([new Date('2026-06-01')]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([]);

      await service.getDailyStatusTrend('2026-06', manager);

      expect(repository.getStatusCountsByDayMonth).toHaveBeenCalledWith(
        2026, 6, manager.userId, false,
      );
    });

    it('returns 28 days for February in a non-leap year', async () => {
      const days = Array.from({ length: 28 }, (_, i) =>
        new Date(`2026-02-${String(i + 1).padStart(2, '0')}`),
      );
      repository.getDaysInMonth.mockReturnValue(days);
      repository.getStatusCountsByDayMonth.mockResolvedValue([]);

      const result = await service.getDailyStatusTrend('2026-02', manager);

      expect(result.days).toHaveLength(28);
    });

    it('returns 29 days for February in a leap year', async () => {
      const days = Array.from({ length: 29 }, (_, i) =>
        new Date(`2024-02-${String(i + 1).padStart(2, '0')}`),
      );
      repository.getDaysInMonth.mockReturnValue(days);
      repository.getStatusCountsByDayMonth.mockResolvedValue([]);

      const result = await service.getDailyStatusTrend('2024-02', manager);

      expect(result.days).toHaveLength(29);
    });

    it('parses the month string into year and monthNum for repository call', async () => {
      repository.getDaysInMonth.mockReturnValue([]);
      repository.getStatusCountsByDayMonth.mockResolvedValue([]);

      await service.getDailyStatusTrend('2025-12', manager);

      expect(repository.getDaysInMonth).toHaveBeenCalledWith(2025, 12);
      expect(repository.getStatusCountsByDayMonth).toHaveBeenCalledWith(2025, 12, manager.userId, false);
    });
  });

  // ── getDailyStatusBreakdown ────────────────────────────────────────────────

  describe('getDailyStatusBreakdown', () => {
    it('returns all zeros for a date with no events', async () => {
      repository.getStatusCountsForDate.mockResolvedValue([]);

      const result = await service.getDailyStatusBreakdown('2026-06-21', manager);

      expect(result).toEqual({
        date: '2026-06-21',
        SUBMITTED: 0, APPROVED: 0, REJECTED: 0, INVOICED: 0,
      });
    });

    it('fills in counts for statuses that have events', async () => {
      repository.getStatusCountsForDate.mockResolvedValue([
        { toStatus: 'SUBMITTED', count: BigInt(2) },
        { toStatus: 'APPROVED',  count: BigInt(1) },
        { toStatus: 'INVOICED',  count: BigInt(1) },
      ]);

      const result = await service.getDailyStatusBreakdown('2026-06-21', manager);

      expect(result).toEqual({
        date: '2026-06-21',
        SUBMITTED: 2, APPROVED: 1, REJECTED: 0, INVOICED: 1,
      });
    });

    it('preserves the date string from the input', async () => {
      repository.getStatusCountsForDate.mockResolvedValue([]);

      const result = await service.getDailyStatusBreakdown('2025-12-31', manager);

      expect(result.date).toBe('2025-12-31');
    });

    it('passes isSalesUser=true and userId to repository for Sales role', async () => {
      repository.getStatusCountsForDate.mockResolvedValue([]);

      await service.getDailyStatusBreakdown('2026-06-21', sales);

      expect(repository.getStatusCountsForDate).toHaveBeenCalledWith(
        expect.any(Date), sales.userId, true,
      );
    });

    it('passes isSalesUser=false for Manager role', async () => {
      repository.getStatusCountsForDate.mockResolvedValue([]);

      await service.getDailyStatusBreakdown('2026-06-21', manager);

      expect(repository.getStatusCountsForDate).toHaveBeenCalledWith(
        expect.any(Date), manager.userId, false,
      );
    });

    it('converts the date string to a Date object for the repository', async () => {
      repository.getStatusCountsForDate.mockResolvedValue([]);

      await service.getDailyStatusBreakdown('2026-06-21', manager);

      const passedDate: Date = repository.getStatusCountsForDate.mock.calls[0][0];
      expect(passedDate).toBeInstanceOf(Date);
      expect(passedDate.toISOString()).toContain('2026-06-21');
    });
  });
});
