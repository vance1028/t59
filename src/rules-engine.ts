import {
  FlightDuty,
  DutyPeriod,
  Violation,
  RulesConfig,
  CrewSummary,
} from './types';
import {
  groupDutiesByCrew,
  groupDutiesIntoPeriods,
  hoursBetween,
  calculateRollingFlightHours,
  calculateConsecutiveDutyDays,
  calculateTimezoneCrossing,
  formatDate,
  formatDateOnly,
  calculateFlightHours,
} from './time-utils';

export function checkAllRules(
  duties: FlightDuty[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];
  const crewDutiesMap = groupDutiesByCrew(duties);

  for (const [crewMember, crewDuties] of crewDutiesMap) {
    const periods = groupDutiesIntoPeriods(crewDuties);
    
    violations.push(...checkMaxDutyPeriod(crewMember, periods, rules));
    violations.push(...checkMinRestBetweenDuties(crewMember, periods, rules));
    violations.push(...checkRollingFlightHours7Days(crewMember, periods, rules));
    violations.push(...checkRollingFlightHours28Days(crewMember, periods, rules));
    violations.push(...checkMaxConsecutiveDutyDays(crewMember, periods, rules));
    violations.push(...checkTimezoneCrossingRest(crewMember, periods, rules));
  }

  return violations;
}

function checkMaxDutyPeriod(
  crewMember: string,
  periods: DutyPeriod[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    if (period.durationHours > rules.maxDutyPeriodHours) {
      violations.push({
        crewMember,
        dutyPeriodIndex: i,
        flightNumber: period.duties.map(d => d.flightNumber).join(', '),
        ruleId: 'MAX_DUTY_PERIOD',
        ruleName: '单次值勤期最长时长限制',
        message: `值勤期从 ${formatDate(period.checkInTime)} 到 ${formatDate(period.checkOutTime)}，时长 ${period.durationHours.toFixed(2)} 小时，超过上限 ${rules.maxDutyPeriodHours} 小时`,
        actualValue: period.durationHours,
        limitValue: rules.maxDutyPeriodHours,
        unit: '小时',
        excess: period.durationHours - rules.maxDutyPeriodHours,
      });
    }
  }

  return violations;
}

function checkMinRestBetweenDuties(
  crewMember: string,
  periods: DutyPeriod[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];

  for (let i = 1; i < periods.length; i++) {
    const prev = periods[i - 1];
    const curr = periods[i];
    
    const restHours = hoursBetween(prev.checkOutTime, curr.checkInTime);
    
    if (restHours < rules.minRestBetweenDutiesHours) {
      violations.push({
        crewMember,
        dutyPeriodIndex: i,
        flightNumber: curr.duties.map(d => d.flightNumber).join(', '),
        ruleId: 'MIN_REST_BETWEEN_DUTIES',
        ruleName: '两段值勤间最小休息时间',
        message: `前值勤 ${formatDate(prev.checkInTime)} 结束于 ${formatDate(prev.checkOutTime)}，下一值勤开始于 ${formatDate(curr.checkInTime)}，休息时间 ${restHours.toFixed(2)} 小时，不足 ${rules.minRestBetweenDutiesHours} 小时`,
        actualValue: restHours,
        limitValue: rules.minRestBetweenDutiesHours,
        unit: '小时',
        excess: rules.minRestBetweenDutiesHours - restHours,
      });
    }
  }

  return violations;
}

function checkRollingFlightHours7Days(
  crewMember: string,
  periods: DutyPeriod[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];
  const rollingResults = calculateRollingFlightHours(periods, 7);

  for (const result of rollingResults) {
    if (result.totalHours > rules.maxFlightHours7Days) {
      violations.push({
        crewMember,
        flightNumber: result.period.duties.map(d => d.flightNumber).join(', '),
        ruleId: 'MAX_FLIGHT_7DAYS',
        ruleName: '任意7天累计飞行上限',
        message: `截至 ${formatDate(result.windowEnd)} 的连续7天内，累计飞行 ${result.totalHours.toFixed(2)} 小时，超过上限 ${rules.maxFlightHours7Days} 小时`,
        actualValue: result.totalHours,
        limitValue: rules.maxFlightHours7Days,
        unit: '小时',
        excess: result.totalHours - rules.maxFlightHours7Days,
      });
    }
  }

  return violations;
}

function checkRollingFlightHours28Days(
  crewMember: string,
  periods: DutyPeriod[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];
  const rollingResults = calculateRollingFlightHours(periods, 28);

  for (const result of rollingResults) {
    if (result.totalHours > rules.maxFlightHours28Days) {
      violations.push({
        crewMember,
        flightNumber: result.period.duties.map(d => d.flightNumber).join(', '),
        ruleId: 'MAX_FLIGHT_28DAYS',
        ruleName: '任意28天累计飞行上限',
        message: `截至 ${formatDate(result.windowEnd)} 的连续28天内，累计飞行 ${result.totalHours.toFixed(2)} 小时，超过上限 ${rules.maxFlightHours28Days} 小时`,
        actualValue: result.totalHours,
        limitValue: rules.maxFlightHours28Days,
        unit: '小时',
        excess: result.totalHours - rules.maxFlightHours28Days,
      });
    }
  }

  return violations;
}

function checkMaxConsecutiveDutyDays(
  crewMember: string,
  periods: DutyPeriod[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];
  const streaks = calculateConsecutiveDutyDays(periods);

  for (const streak of streaks) {
    if (streak.streak > rules.maxConsecutiveDutyDays) {
      violations.push({
        crewMember,
        ruleId: 'MAX_CONSECUTIVE_DAYS',
        ruleName: '连续值勤天数上限',
        message: `截至 ${formatDateOnly(streak.endDate)}，已连续值勤 ${streak.streak} 天，超过上限 ${rules.maxConsecutiveDutyDays} 天`,
        actualValue: streak.streak,
        limitValue: rules.maxConsecutiveDutyDays,
        unit: '天',
        excess: streak.streak - rules.maxConsecutiveDutyDays,
      });
    }
  }

  return violations;
}

function checkTimezoneCrossingRest(
  crewMember: string,
  periods: DutyPeriod[],
  rules: RulesConfig
): Violation[] {
  const violations: Violation[] = [];

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    let maxTimezoneCross = 0;
    
    for (const duty of period.duties) {
      const cross = calculateTimezoneCrossing(duty);
      if (cross > maxTimezoneCross) {
        maxTimezoneCross = cross;
      }
    }

    if (maxTimezoneCross < rules.timezoneCrossingThreshold) {
      continue;
    }

    if (i < periods.length - 1) {
      const nextPeriod = periods[i + 1];
      const baseRestHours = rules.minRestAfterTimezoneCrossingHours;
      const additionalRest = (maxTimezoneCross - rules.timezoneCrossingThreshold + 1) * rules.additionalRestPerTimezone;
      const requiredRest = baseRestHours + additionalRest;
      const actualRest = hoursBetween(period.checkOutTime, nextPeriod.checkInTime);

      if (actualRest < requiredRest) {
        violations.push({
          crewMember,
          dutyPeriodIndex: i + 1,
          flightNumber: nextPeriod.duties.map(d => d.flightNumber).join(', '),
          ruleId: 'TIMEZONE_REST',
          ruleName: '跨时区飞行后休息要求',
          message: `跨 ${maxTimezoneCross} 个时区飞行后，休息时间 ${actualRest.toFixed(2)} 小时，不足要求的 ${requiredRest.toFixed(2)} 小时`,
          actualValue: actualRest,
          limitValue: requiredRest,
          unit: '小时',
          excess: requiredRest - actualRest,
        });
      }
    } else {
      violations.push({
        crewMember,
        dutyPeriodIndex: i,
        flightNumber: period.duties.map(d => d.flightNumber).join(', '),
        ruleId: 'TIMEZONE_REST_LAST_PERIOD',
        ruleName: '跨时区飞行后休息要求（待确认）',
        message: `跨 ${maxTimezoneCross} 个时区飞行后为最后一个值勤期，无法验证后续休息时间是否满足 ${rules.minRestAfterTimezoneCrossingHours} 小时要求，请人工确认`,
        actualValue: 0,
        limitValue: rules.minRestAfterTimezoneCrossingHours,
        unit: '小时',
        excess: 0,
      });
    }
  }

  return violations;
}

export function generateSummary(duties: FlightDuty[]): CrewSummary[] {
  const summaries: CrewSummary[] = [];
  const crewDutiesMap = groupDutiesByCrew(duties);

  for (const [crewMember, crewDuties] of crewDutiesMap) {
    const periods = groupDutiesIntoPeriods(crewDuties);
    
    let totalFlightHours = 0;
    let totalDutyHours = 0;
    let firstDutyDate: Date | null = null;
    let lastDutyDate: Date | null = null;

    for (const period of periods) {
      totalFlightHours += period.flightHours;
      totalDutyHours += period.durationHours;
      
      if (!firstDutyDate || period.checkInTime < firstDutyDate) {
        firstDutyDate = period.checkInTime;
      }
      if (!lastDutyDate || period.checkOutTime > lastDutyDate) {
        lastDutyDate = period.checkOutTime;
      }
    }

    summaries.push({
      crewMember,
      totalFlightHours: Number(totalFlightHours.toFixed(2)),
      totalDutyHours: Number(totalDutyHours.toFixed(2)),
      dutyPeriodCount: periods.length,
      flightCount: crewDuties.length,
      firstDutyDate: firstDutyDate ? formatDate(firstDutyDate) : '-',
      lastDutyDate: lastDutyDate ? formatDate(lastDutyDate) : '-',
    });
  }

  return summaries.sort((a, b) => a.crewMember.localeCompare(b.crewMember));
}
