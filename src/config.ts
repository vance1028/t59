import * as fs from 'fs';
import * as path from 'path';
import { RulesConfig } from './types';

export const DEFAULT_RULES: RulesConfig = {
  maxDutyPeriodHours: 14,
  minRestBetweenDutiesHours: 12,
  maxFlightHours7Days: 40,
  maxFlightHours28Days: 100,
  maxConsecutiveDutyDays: 7,
  timezoneCrossingThreshold: 3,
  additionalRestPerTimezone: 1,
  minRestAfterTimezoneCrossingHours: 14,
};

export function loadRulesConfig(customPath?: string): RulesConfig {
  const defaultPath = path.join(process.cwd(), 'rules.default.json');
  
  let configPath: string;
  if (customPath) {
    configPath = path.resolve(customPath);
    if (!fs.existsSync(configPath)) {
      throw new Error(`规则配置文件不存在: ${configPath}`);
    }
  } else if (fs.existsSync(defaultPath)) {
    configPath = defaultPath;
  } else {
    return { ...DEFAULT_RULES };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const customRules = JSON.parse(content) as Partial<RulesConfig>;
    return { ...DEFAULT_RULES, ...customRules };
  } catch (error) {
    throw new Error(`解析规则配置文件失败: ${(error as Error).message}`);
  }
}

export function getRuleDescriptions(): Record<keyof RulesConfig, { name: string; description: string }> {
  return {
    maxDutyPeriodHours: {
      name: '单次值勤期最长时长',
      description: '单个值勤期（从报到至解除值勤）的最长小时数',
    },
    minRestBetweenDutiesHours: {
      name: '两段值勤间最小休息时间',
      description: '连续两个值勤期之间的最短休息小时数',
    },
    maxFlightHours7Days: {
      name: '任意7天累计飞行上限',
      description: '任意连续7天内的累计飞行小时上限',
    },
    maxFlightHours28Days: {
      name: '任意28天累计飞行上限',
      description: '任意连续28天内的累计飞行小时上限',
    },
    maxConsecutiveDutyDays: {
      name: '连续值勤天数上限',
      description: '连续值勤的最大天数',
    },
    timezoneCrossingThreshold: {
      name: '时区跨越阈值',
      description: '触发额外休息要求的最少时区跨越数',
    },
    additionalRestPerTimezone: {
      name: '每时区额外休息',
      description: '每跨越一个时区需要额外增加的休息小时数',
    },
    minRestAfterTimezoneCrossingHours: {
      name: '跨时区后最低休息',
      description: '跨多时区飞行后的最低休息小时数',
    },
  };
}
