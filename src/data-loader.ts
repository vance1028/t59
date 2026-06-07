import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { FlightDuty, CrewRole } from './types';

const VALID_ROLES: CrewRole[] = ['captain', 'first_officer', 'cabin'];

export function loadFlightDuties(filePath: string): FlightDuty[] {
  const resolvedPath = path.resolve(filePath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`文件不存在: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  
  if (ext === '.json') {
    return loadFromJson(resolvedPath);
  } else if (ext === '.csv') {
    return loadFromCsv(resolvedPath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}。支持 .json 和 .csv 格式`);
  }
}

function loadFromJson(filePath: string): FlightDuty[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) {
      throw new Error('JSON 文件必须是数组格式');
    }

    return data.map((item: any, index: number) => validateAndTransformDuty(item, index + 1));
  } catch (error) {
    throw new Error(`解析 JSON 文件失败: ${(error as Error).message}`);
  }
}

function loadFromCsv(filePath: string): FlightDuty[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((item: any, index: number) => validateAndTransformDuty(item, index + 1));
  } catch (error) {
    throw new Error(`解析 CSV 文件失败: ${(error as Error).message}`);
  }
}

function validateAndTransformDuty(item: any, lineNumber: number): FlightDuty {
  const requiredFields = ['flightNumber', 'crewMember', 'role', 'checkInTime', 'departureTime', 'arrivalTime', 'checkOutTime'];
  
  for (const field of requiredFields) {
    if (item[field] === undefined || item[field] === null || item[field] === '') {
      throw new Error(`第 ${lineNumber} 条数据缺少必填字段: ${field}`);
    }
  }

  const role = item.role.trim().toLowerCase() as CrewRole;
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`第 ${lineNumber} 条数据的 role 字段无效: ${item.role}。有效值: ${VALID_ROLES.join(', ')}`);
  }

  const duty: FlightDuty = {
    flightNumber: String(item.flightNumber).trim(),
    crewMember: String(item.crewMember).trim(),
    role,
    checkInTime: String(item.checkInTime).trim(),
    departureTime: String(item.departureTime).trim(),
    arrivalTime: String(item.arrivalTime).trim(),
    checkOutTime: String(item.checkOutTime).trim(),
  };

  if (item.departureTimezone !== undefined && item.departureTimezone !== '') {
    const tz = Number(item.departureTimezone);
    if (isNaN(tz)) {
      throw new Error(`第 ${lineNumber} 条数据的 departureTimezone 无效: ${item.departureTimezone}`);
    }
    duty.departureTimezone = tz;
  }

  if (item.arrivalTimezone !== undefined && item.arrivalTimezone !== '') {
    const tz = Number(item.arrivalTimezone);
    if (isNaN(tz)) {
      throw new Error(`第 ${lineNumber} 条数据的 arrivalTimezone 无效: ${item.arrivalTimezone}`);
    }
    duty.arrivalTimezone = tz;
  }

  return duty;
}
