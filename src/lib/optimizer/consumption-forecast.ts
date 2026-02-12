import type { ConsumptionRecord, OilGradeCategory } from './types';

interface DailyConsumption {
  date: string;
  cylinderOil: number;
  meSystemOil: number;
  aeSystemOil: number;
}

/**
 * Compute daily consumption rates from noon reports.
 * Uses a weighted rolling average: more recent data has higher weight.
 */
export function computeDailyConsumption(
  records: ConsumptionRecord[]
): DailyConsumption[] {
  // Filter to "At Sea" noon reports (most reliable for consumption)
  const seaReports = records.filter(
    (r) => r.state === 'At Sea' && r.reportType === 'NOON'
  );

  if (seaReports.length === 0) return [];

  // Sort by date
  seaReports.sort(
    (a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime()
  );

  return seaReports.map((r) => ({
    date: r.reportDate,
    cylinderOil: r.cylinderOilConsumption,
    meSystemOil: r.meSystemOilConsumption,
    aeSystemOil: r.aeSystemOilConsumption,
  }));
}

/**
 * Compute weighted average daily consumption over last N months.
 * Weights: more recent months weighted higher (linearly increasing).
 */
export function weightedAvgConsumption(
  dailyRecords: DailyConsumption[],
  months: number = 6
): { cylinderOil: number; meSystemOil: number; aeSystemOil: number } {
  if (dailyRecords.length === 0) {
    return { cylinderOil: 0, meSystemOil: 0, aeSystemOil: 0 };
  }

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const filtered = dailyRecords.filter(
    (r) => new Date(r.date) >= cutoffDate
  );

  if (filtered.length === 0) {
    // Fall back to all available data
    const avg = {
      cylinderOil: dailyRecords.reduce((s, r) => s + r.cylinderOil, 0) / dailyRecords.length,
      meSystemOil: dailyRecords.reduce((s, r) => s + r.meSystemOil, 0) / dailyRecords.length,
      aeSystemOil: dailyRecords.reduce((s, r) => s + r.aeSystemOil, 0) / dailyRecords.length,
    };
    return avg;
  }

  // Assign linearly increasing weights
  let totalWeight = 0;
  let weightedCyl = 0;
  let weightedME = 0;
  let weightedAE = 0;

  filtered.forEach((r, idx) => {
    const weight = idx + 1; // 1, 2, 3, ... (more recent = higher)
    totalWeight += weight;
    weightedCyl += r.cylinderOil * weight;
    weightedME += r.meSystemOil * weight;
    weightedAE += r.aeSystemOil * weight;
  });

  return {
    cylinderOil: weightedCyl / totalWeight,
    meSystemOil: weightedME / totalWeight,
    aeSystemOil: weightedAE / totalWeight,
  };
}

/**
 * Compute the dynamic minimum ROB for cylinder oil.
 * = avgDailyConsumption × minRobDays (default 60)
 */
export function computeCylinderMinRob(
  avgDailyConsumption: number,
  minRobDays: number = 60
): number {
  return avgDailyConsumption * minRobDays;
}

/**
 * Forecast consumption for a given number of sea days.
 */
export function forecastConsumption(
  avgDaily: { cylinderOil: number; meSystemOil: number; aeSystemOil: number },
  seaDays: number,
  safetyBufferPct: number = 0
): { cylinderOil: number; meSystemOil: number; aeSystemOil: number } {
  const buffer = 1 + safetyBufferPct / 100;
  return {
    cylinderOil: avgDaily.cylinderOil * seaDays * buffer,
    meSystemOil: avgDaily.meSystemOil * seaDays * buffer,
    aeSystemOil: avgDaily.aeSystemOil * seaDays * buffer,
  };
}

/**
 * Get the average daily consumption for a specific oil grade.
 */
export function getAvgForGrade(
  avg: { cylinderOil: number; meSystemOil: number; aeSystemOil: number },
  grade: OilGradeCategory
): number {
  switch (grade) {
    case 'cylinderOil':
      return avg.cylinderOil;
    case 'meSystemOil':
      return avg.meSystemOil;
    case 'aeSystemOil':
      return avg.aeSystemOil;
  }
}
