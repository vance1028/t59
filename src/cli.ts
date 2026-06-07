#!/usr/bin/env node

import { Command } from 'commander';
import { loadFlightDuties } from './data-loader';
import { loadRulesConfig } from './config';
import { checkAllRules, generateSummary } from './rules-engine';
import {
  formatCheckResult,
  formatSummary,
  formatRules,
} from './output-formatter';
import { OutputFormat } from './types';

const program = new Command();

program
  .name('crew-duty')
  .description('航空公司机组排班合规校验工具')
  .version('1.0.0');

program
  .command('check')
  .description('校验排班表的合规性')
  .argument('<file>', '排班数据文件路径 (.json 或 .csv)')
  .option('-r, --rules <path>', '自定义规则配置文件路径')
  .option('-f, --format <format>', '输出格式: json|table', 'table' as OutputFormat)
  .action(async (file: string, options: { rules?: string; format: OutputFormat }) => {
    try {
      const format = options.format as OutputFormat;
      if (!['json', 'table'].includes(format)) {
        console.error(`错误: 无效的输出格式 '${format}'，请使用 'json' 或 'table'`);
        process.exit(1);
      }

      const duties = loadFlightDuties(file);
      const rules = loadRulesConfig(options.rules);
      const violations = checkAllRules(duties, rules);

      const output = formatCheckResult(violations, duties.length, format);
      console.log(output);

      if (violations.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(2);
    }
  });

program
  .command('summary')
  .description('生成每个机组的飞行小时汇总')
  .argument('<file>', '排班数据文件路径 (.json 或 .csv)')
  .option('-f, --format <format>', '输出格式: json|table', 'table' as OutputFormat)
  .action(async (file: string, options: { format: OutputFormat }) => {
    try {
      const format = options.format as OutputFormat;
      if (!['json', 'table'].includes(format)) {
        console.error(`错误: 无效的输出格式 '${format}'，请使用 'json' 或 'table'`);
        process.exit(1);
      }

      const duties = loadFlightDuties(file);
      const summaries = generateSummary(duties);

      const output = formatSummary(summaries, format);
      console.log(output);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(2);
    }
  });

program
  .command('rules')
  .description('查看当前规则配置')
  .option('-r, --rules <path>', '自定义规则配置文件路径')
  .option('-f, --format <format>', '输出格式: json|table', 'table' as OutputFormat)
  .action(async (options: { rules?: string; format: OutputFormat }) => {
    try {
      const format = options.format as OutputFormat;
      if (!['json', 'table'].includes(format)) {
        console.error(`错误: 无效的输出格式 '${format}'，请使用 'json' 或 'table'`);
        process.exit(1);
      }

      const rules = loadRulesConfig(options.rules);
      const output = formatRules(rules, format);
      console.log(output);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(2);
    }
  });

program.parseAsync(process.argv);
