import { table } from 'table';
import { Violation, CrewSummary, RulesConfig, OutputFormat } from './types';
import { getRuleDescriptions } from './config';

export function formatViolations(violations: Violation[], format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify(violations, null, 2);
  }

  if (violations.length === 0) {
    return '✅ 未发现任何违规记录';
  }

  const headers = ['机组成员', '航班号', '规则', '违规描述', '实际值', '限制值', '单位', '超出'];
  const rows = [headers];

  for (const v of violations) {
    rows.push([
      v.crewMember,
      v.flightNumber || '-',
      v.ruleName,
      v.message,
      v.actualValue.toFixed(2),
      v.limitValue.toFixed(2),
      v.unit,
      v.excess.toFixed(2),
    ]);
  }

  return table(rows, {
    columnDefault: {
      wrapWord: true,
    },
    columns: {
      3: { width: 50 },
    },
  });
}

export function formatSummary(summaries: CrewSummary[], format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify(summaries, null, 2);
  }

  if (summaries.length === 0) {
    return '无数据';
  }

  const headers = ['机组成员', '总飞行小时', '总值勤小时', '值勤期数', '航班数', '首次值勤', '末次值勤'];
  const rows = [headers];

  for (const s of summaries) {
    rows.push([
      s.crewMember,
      s.totalFlightHours.toFixed(2),
      s.totalDutyHours.toFixed(2),
      String(s.dutyPeriodCount),
      String(s.flightCount),
      s.firstDutyDate,
      s.lastDutyDate,
    ]);
  }

  return table(rows);
}

export function formatRules(rules: RulesConfig, format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify(rules, null, 2);
  }

  const descriptions = getRuleDescriptions();
  const headers = ['规则ID', '规则名称', '当前值', '说明'];
  const rows = [headers];

  for (const [key, value] of Object.entries(rules) as [keyof RulesConfig, number][]) {
    const desc = descriptions[key];
    rows.push([
      key,
      desc.name,
      String(value),
      desc.description,
    ]);
  }

  return table(rows, {
    columns: {
      3: { width: 40, wrapWord: true },
    },
  });
}

export function formatCheckResult(
  violations: Violation[],
  totalChecked: number,
  format: OutputFormat
): string {
  if (format === 'json') {
    return JSON.stringify({
      violations,
      totalViolations: violations.length,
      totalChecked,
      passed: violations.length === 0,
    }, null, 2);
  }

  let result = '';
  result += `校验完成：共检查 ${totalChecked} 条航段，发现 ${violations.length} 处违规\n\n`;
  result += formatViolations(violations, format);
  
  if (violations.length > 0) {
    result += `\n❌ 校验不通过，存在 ${violations.length} 处违规\n`;
  } else {
    result += `\n✅ 校验通过，所有排班合规\n`;
  }

  return result;
}
