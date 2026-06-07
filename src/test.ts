import { loadFlightDuties } from './data-loader';
import { loadRulesConfig, DEFAULT_RULES } from './config';
import { checkAllRules, generateSummary } from './rules-engine';
import {
  calculateFlightHours,
  calculateTimezoneCrossing,
  groupDutiesIntoPeriods,
  calculateRollingFlightHours,
  calculateConsecutiveDutyDays,
  hoursBetween,
  parseDateTime,
} from './time-utils';
import { FlightDuty, RulesConfig } from './types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
  }
}

function assertApprox(actual: number, expected: number, testName: string, tolerance = 0.01) {
  const diff = Math.abs(actual - expected);
  assert(diff < tolerance, testName, `actual=${actual}, expected=${expected}, diff=${diff}`);
}

console.log('\n=== 1. 时间计算工具测试 ===\n');

(function testHoursBetween() {
  const a = new Date('2025-06-01T08:00:00Z');
  const b = new Date('2025-06-01T14:00:00Z');
  assertApprox(hoursBetween(a, b), 6, 'hoursBetween: 相差6小时');
})();

(function testParseDateTime() {
  const d = parseDateTime('2025-06-01T08:00:00');
  assert(d instanceof Date, 'parseDateTime: 返回Date对象');
  assert(d.getFullYear() === 2025, 'parseDateTime: 年份正确');
})();

console.log('\n=== 2. 飞行小时与时区计算测试 ===\n');

(function testFlightHoursSameTimezone() {
  const duty: FlightDuty = {
    flightNumber: 'TEST',
    crewMember: '测试',
    role: 'captain',
    checkInTime: '2025-06-01T06:00:00',
    departureTime: '2025-06-01T08:00:00',
    arrivalTime: '2025-06-01T11:00:00',
    checkOutTime: '2025-06-01T12:00:00',
    departureTimezone: 8,
    arrivalTimezone: 8,
  };
  assertApprox(calculateFlightHours(duty), 3, '同 timezone 飞行小时 = 3h');
})();

(function testFlightHoursCrossTimezone() {
  const duty: FlightDuty = {
    flightNumber: 'TEST',
    crewMember: '测试',
    role: 'captain',
    checkInTime: '2025-06-01T06:00:00',
    departureTime: '2025-06-01T12:00:00',
    arrivalTime: '2025-06-01T20:00:00',
    checkOutTime: '2025-06-01T21:00:00',
    departureTimezone: 8,
    arrivalTimezone: 1,
  };
  const hours = calculateFlightHours(duty);
  assertApprox(hours, 15, '北京12:00(UTC+8)->伦敦20:00(UTC+1) = 15h', 0.01);
})();

(function testFlightHoursCrossTimezoneEastbound() {
  const duty: FlightDuty = {
    flightNumber: 'TEST',
    crewMember: '测试',
    role: 'captain',
    checkInTime: '2025-06-01T06:00:00',
    departureTime: '2025-06-01T20:00:00',
    arrivalTime: '2025-06-02T10:00:00',
    checkOutTime: '2025-06-02T11:00:00',
    departureTimezone: 0,
    arrivalTimezone: 8,
  };
  const hours = calculateFlightHours(duty);
  assertApprox(hours, 6, '伦敦20:00(UTC+0)->北京10:00次日(UTC+8) = 6h (UTC 20:00->02:00)', 0.01);
})();

(function testFlightHoursNoTimezone() {
  const duty: FlightDuty = {
    flightNumber: 'TEST',
    crewMember: '测试',
    role: 'captain',
    checkInTime: '2025-06-01T06:00:00',
    departureTime: '2025-06-01T08:00:00',
    arrivalTime: '2025-06-01T10:00:00',
    checkOutTime: '2025-06-01T11:00:00',
  };
  assertApprox(calculateFlightHours(duty), 2, '无 timezone 字段时按原始时间算 = 2h');
})();

(function testTimezoneCrossing() {
  const duty: FlightDuty = {
    flightNumber: 'TEST', crewMember: '测试', role: 'captain',
    checkInTime: '2025-06-01T06:00:00',
    departureTime: '2025-06-01T08:00:00',
    arrivalTime: '2025-06-01T20:00:00',
    checkOutTime: '2025-06-01T21:00:00',
    departureTimezone: 8,
    arrivalTimezone: 1,
  };
  assert(calculateTimezoneCrossing(duty) === 7, '时区跨越数 = 7');
})();

console.log('\n=== 3. 值勤期分组测试 ===\n');

(function testGroupDutiesIntoPeriods() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T10:00:00', checkOutTime: '2025-06-01T11:00:00' },
    { flightNumber: 'F2', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T15:00:00', departureTime: '2025-06-01T16:00:00', arrivalTime: '2025-06-01T18:00:00', checkOutTime: '2025-06-01T19:00:00' },
    { flightNumber: 'F3', crewMember: 'A', role: 'captain', checkInTime: '2025-06-02T08:00:00', departureTime: '2025-06-02T10:00:00', arrivalTime: '2025-06-02T12:00:00', checkOutTime: '2025-06-02T13:00:00' },
  ];
  const periods = groupDutiesIntoPeriods(duties);
  assert(periods.length === 2, '同一天的两段合并为一个值勤期');
  assert(periods[0].duties.length === 2, '第一个值勤期包含2个航段');
  assertApprox(periods[0].flightHours, 4, '第一个值勤期飞行4小时');
  assertApprox(periods[0].durationHours, 13, '第一个值勤期值勤13小时 (06:00-19:00)');
})();

console.log('\n=== 4. 滚动窗口累计测试 ===\n');

(function testRollingWindow7Days() {
  const duties: FlightDuty[] = [];
  for (let d = 1; d <= 10; d++) {
    const day = d < 10 ? `0${d}` : `${d}`;
    duties.push({
      flightNumber: `F${d}`,
      crewMember: 'A',
      role: 'captain',
      checkInTime: `2025-06-${day}T06:00:00`,
      departureTime: `2025-06-${day}T08:00:00`,
      arrivalTime: `2025-06-${day}T12:00:00`,
      checkOutTime: `2025-06-${day}T13:00:00`,
    });
  }
  const periods = groupDutiesIntoPeriods(duties);
  const rolling = calculateRollingFlightHours(periods, 7);

  const lastResult = rolling[rolling.length - 1];
  assertApprox(lastResult.totalHours, 28, '第10天：连续7天窗口内(4-10号) 7天*4h = 28h');

  const seventhResult = rolling[6];
  assertApprox(seventhResult.totalHours, 28, '第7天：窗口内(1-7号) 7天*4h = 28h');
})();

(function testRollingWindowGap() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T12:00:00', checkOutTime: '2025-06-01T13:00:00' },
    { flightNumber: 'F2', crewMember: 'A', role: 'captain', checkInTime: '2025-06-05T06:00:00', departureTime: '2025-06-05T08:00:00', arrivalTime: '2025-06-05T12:00:00', checkOutTime: '2025-06-05T13:00:00' },
    { flightNumber: 'F3', crewMember: 'A', role: 'captain', checkInTime: '2025-06-09T06:00:00', departureTime: '2025-06-09T08:00:00', arrivalTime: '2025-06-09T12:00:00', checkOutTime: '2025-06-09T13:00:00' },
  ];
  const periods = groupDutiesIntoPeriods(duties);
  const rolling = calculateRollingFlightHours(periods, 7);

  assertApprox(rolling[0].totalHours, 4, '6月1日: 窗口内只有1天飞行 = 4h');
  assertApprox(rolling[1].totalHours, 8, '6月5日: 窗口[5月29日-6月5日]内6月1日+6月5日 = 8h');
  assertApprox(rolling[2].totalHours, 8, '6月9日: 窗口[6月2日-6月9日]内6月5日+6月9日 = 8h');
})();

(function testRollingWindowExactBoundary() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T12:00:00', checkOutTime: '2025-06-01T13:00:00' },
    { flightNumber: 'F2', crewMember: 'A', role: 'captain', checkInTime: '2025-06-08T06:00:00', departureTime: '2025-06-08T08:00:00', arrivalTime: '2025-06-08T12:00:00', checkOutTime: '2025-06-08T13:00:00' },
  ];
  const periods = groupDutiesIntoPeriods(duties);
  const rolling = calculateRollingFlightHours(periods, 7);

  assertApprox(rolling[1].totalHours, 4, '6月8日13:00往前7天=6月1日13:00，6月1日checkout恰好等于windowStart(严格>不包含)，窗口内仅6月8日 = 4h');
})();

console.log('\n=== 5. 连续值勤天数测试 ===\n');

(function testConsecutiveDutyDays() {
  const duties: FlightDuty[] = [];
  for (let d = 1; d <= 8; d++) {
    const day = `0${d}`;
    duties.push({
      flightNumber: `F${d}`,
      crewMember: 'A',
      role: 'captain',
      checkInTime: `2025-06-${day}T06:00:00`,
      departureTime: `2025-06-${day}T08:00:00`,
      arrivalTime: `2025-06-${day}T10:00:00`,
      checkOutTime: `2025-06-${day}T11:00:00`,
    });
  }
  const periods = groupDutiesIntoPeriods(duties);
  const streaks = calculateConsecutiveDutyDays(periods);
  const last = streaks[streaks.length - 1];
  assert(last.streak === 8, '连续8天值勤');
})();

console.log('\n=== 6. 合规校验规则测试 ===\n');

(function testMaxDutyPeriodViolation() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T22:00:00', checkOutTime: '2025-06-01T23:00:00' },
  ];
  const violations = checkAllRules(duties, DEFAULT_RULES);
  const v = violations.find(v => v.ruleId === 'MAX_DUTY_PERIOD');
  assert(!!v, '值勤期17h > 14h 上限，应报违规');
  if (v) assertApprox(v.excess, 3, '超出3小时');
})();

(function testMinRestViolation() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T10:00:00', checkOutTime: '2025-06-01T11:00:00' },
    { flightNumber: 'F2', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T18:00:00', departureTime: '2025-06-01T19:00:00', arrivalTime: '2025-06-01T21:00:00', checkOutTime: '2025-06-01T22:00:00' },
  ];
  const rules = { ...DEFAULT_RULES, minRestBetweenDutiesHours: 12 };
  const violations = checkAllRules(duties, rules);
  const v = violations.find(v => v.ruleId === 'MIN_REST_BETWEEN_DUTIES');
  assert(!v, '同一天两段视为同一值勤期，不触发休息不足');
})();

(function testMinRestViolationAcrossDays() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T10:00:00', checkOutTime: '2025-06-01T22:00:00' },
    { flightNumber: 'F2', crewMember: 'A', role: 'captain', checkInTime: '2025-06-02T06:00:00', departureTime: '2025-06-02T08:00:00', arrivalTime: '2025-06-02T10:00:00', checkOutTime: '2025-06-02T11:00:00' },
  ];
  const violations = checkAllRules(duties, DEFAULT_RULES);
  const v = violations.find(v => v.ruleId === 'MIN_REST_BETWEEN_DUTIES');
  assert(!!v, '跨天两段值勤休息8h < 12h，应报违规');
})();

(function testTimezoneRestViolation() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T20:00:00', checkOutTime: '2025-06-01T21:00:00', departureTimezone: 8, arrivalTimezone: 1 },
    { flightNumber: 'F2', crewMember: 'A', role: 'captain', checkInTime: '2025-06-02T06:00:00', departureTime: '2025-06-02T08:00:00', arrivalTime: '2025-06-02T10:00:00', checkOutTime: '2025-06-02T11:00:00' },
  ];
  const rules: RulesConfig = { ...DEFAULT_RULES, timezoneCrossingThreshold: 2 };
  const violations = checkAllRules(duties, rules);
  const v = violations.find(v => v.ruleId === 'TIMEZONE_REST');
  assert(!!v, '跨7时区后休息9h不足14h，应报违规');
})();

(function testTimezoneRestLastPeriodWarning() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T20:00:00', checkOutTime: '2025-06-01T21:00:00', departureTimezone: 8, arrivalTimezone: 1 },
  ];
  const rules: RulesConfig = { ...DEFAULT_RULES, timezoneCrossingThreshold: 2 };
  const violations = checkAllRules(duties, rules);
  const v = violations.find(v => v.ruleId === 'TIMEZONE_REST_LAST_PERIOD');
  assert(!!v, '最后一个值勤期跨时区，无后续排班，应报提示');
})();

(function testNoViolation() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T10:00:00', checkOutTime: '2025-06-01T11:00:00' },
  ];
  const violations = checkAllRules(duties, DEFAULT_RULES);
  assert(violations.length === 0, '单次合规排班不应有违规');
})();

console.log('\n=== 7. 数据加载测试 ===\n');

(function testLoadJsonSample() {
  try {
    const duties = loadFlightDuties('examples/sample-schedule.json');
    assert(duties.length > 0, '加载 JSON 示例数据成功');
  } catch (e) {
    assert(false, '加载 JSON 示例数据', (e as Error).message);
  }
})();

(function testLoadCsvSample() {
  try {
    const duties = loadFlightDuties('examples/sample-schedule.csv');
    assert(duties.length > 0, '加载 CSV 示例数据成功');
  } catch (e) {
    assert(false, '加载 CSV 示例数据', (e as Error).message);
  }
})();

console.log('\n=== 8. 汇总测试 ===\n');

(function testGenerateSummary() {
  const duties: FlightDuty[] = [
    { flightNumber: 'F1', crewMember: 'A', role: 'captain', checkInTime: '2025-06-01T06:00:00', departureTime: '2025-06-01T08:00:00', arrivalTime: '2025-06-01T10:00:00', checkOutTime: '2025-06-01T11:00:00' },
    { flightNumber: 'F2', crewMember: 'B', role: 'cabin', checkInTime: '2025-06-01T07:00:00', departureTime: '2025-06-01T09:00:00', arrivalTime: '2025-06-01T12:00:00', checkOutTime: '2025-06-01T13:00:00' },
  ];
  const summaries = generateSummary(duties);
  assert(summaries.length === 2, '两个机组成员');
  assert(summaries[0].flightCount === 1, '每人1个航段');
})();

console.log('\n' + '='.repeat(40));
console.log(`测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
console.log('='.repeat(40) + '\n');

if (failed > 0) {
  process.exit(1);
}
