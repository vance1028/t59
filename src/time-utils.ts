import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { FlightDuty, DutyPeriod } from './types';

dayjs.extend(utc);
dayjs.extend(timezone);

export const MS_PER_HOUR = 1000 * 60 * 60;
export const MS_PER_DAY = MS_PER_HOUR * 24;

export function parseDateTime(dateTimeStr: string): Date {
  const d = dayjs(dateTimeStr);
  if (!d.isValid()) {
    throw new Error(`无效的日期时间格式: ${dateTimeStr}`);
  }
  return d.toDate();
}

export function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MS_PER_HOUR;
}

export function daysBetween(start: Date, end: Date): number {
  const s = dayjs(start).startOf('day');
  const e = dayjs(end).startOf('day');
  return e.diff(s, 'day');
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return dayjs(d1).isSame(d2, 'day');
}

export function addDays(date: Date, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

export function formatDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm');
}

export function formatDateOnly(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

export function calculateFlightHours(duty: FlightDuty): number {
  const dep = parseDateTime(duty.departureTime);
  const arr = parseDateTime(duty.arrivalTime);
  return hoursBetween(dep, arr);
}

export function calculateTimezoneCrossing(duty: FlightDuty): number {
  if (duty.departureTimezone === undefined || duty.arrivalTimezone === undefined) {
    return 0;
  }
  return Math.abs(duty.arrivalTimezone - duty.departureTimezone);
}

export function groupDutiesIntoPeriods(duties: FlightDuty[]): DutyPeriod[] {
  if (duties.length === 0) return [];

  const sorted = [...duties].sort((a, b) => 
    parseDateTime(a.checkInTime).getTime() - parseDateTime(b.checkInTime).getTime()
  );

  const periods: DutyPeriod[] = [];
  let currentDuties: FlightDuty[] = [sorted[0]];
  let periodCheckIn = parseDateTime(sorted[0].checkInTime);
  let periodCheckOut = parseDateTime(sorted[0].checkOutTime);

  for (let i = 1; i < sorted.length; i++) {
    const duty = sorted[i];
    const dutyCheckIn = parseDateTime(duty.checkInTime);

    if (isSameDay(dutyCheckIn, periodCheckIn)) {
      currentDuties.push(duty);
      const dutyCheckOut = parseDateTime(duty.checkOutTime);
      if (dutyCheckOut.getTime() > periodCheckOut.getTime()) {
        periodCheckOut = dutyCheckOut;
      }
    } else {
      periods.push(buildDutyPeriod(currentDuties, periodCheckIn, periodCheckOut));
      currentDuties = [duty];
      periodCheckIn = parseDateTime(duty.checkInTime);
      periodCheckOut = parseDateTime(duty.checkOutTime);
    }
  }

  periods.push(buildDutyPeriod(currentDuties, periodCheckIn, periodCheckOut));
  return periods;
}

function buildDutyPeriod(
  duties: FlightDuty[],
  checkIn: Date,
  checkOut: Date
): DutyPeriod {
  let flightHours = 0;
  for (const duty of duties) {
    flightHours += calculateFlightHours(duty);
  }

  const durationHours = hoursBetween(checkIn, checkOut);

  return {
    crewMember: duties[0].crewMember,
    duties,
    checkInTime: checkIn,
    checkOutTime: checkOut,
    durationHours,
    flightHours,
    startDate: dayjs(checkIn).startOf('day').toDate(),
    endDate: dayjs(checkOut).startOf('day').toDate(),
  };
}

export function calculateRollingFlightHours(
  periods: DutyPeriod[],
  windowDays: number
): Array<{ period: DutyPeriod; windowEnd: Date; totalHours: number }> {
  const results: Array<{ period: DutyPeriod; windowEnd: Date; totalHours: number }> = [];

  for (let i = 0; i < periods.length; i++) {
    const currentPeriod = periods[i];
    const windowEnd = currentPeriod.checkOutTime;
    const windowStart = new Date(windowEnd.getTime() - windowDays * MS_PER_DAY);
    
    let totalHours = 0;
    for (let j = 0; j <= i; j++) {
      const p = periods[j];
      if (p.checkOutTime.getTime() > windowStart.getTime() && p.checkInTime.getTime() <= windowEnd.getTime()) {
        totalHours += p.flightHours;
      }
    }

    results.push({
      period: currentPeriod,
      windowEnd,
      totalHours,
    });
  }

  return results;
}

export function calculateConsecutiveDutyDays(periods: DutyPeriod[]): Array<{ endDate: Date; streak: number }> {
  if (periods.length === 0) return [];

  const results: Array<{ endDate: Date; streak: number }> = [];
  const dutyDaysSet = new Set<string>();
  
  for (const p of periods) {
    const dateStr = formatDateOnly(p.startDate);
    dutyDaysSet.add(dateStr);
  }

  const sortedDays = Array.from(dutyDaysSet).sort();
  
  if (sortedDays.length === 0) return [];

  let currentStreak = 1;
  results.push({ endDate: parseDateTime(sortedDays[0] + 'T00:00:00'), streak: 1 });

  for (let i = 1; i < sortedDays.length; i++) {
    const prevDate = dayjs(sortedDays[i - 1]);
    const currDate = dayjs(sortedDays[i]);
    
    if (currDate.diff(prevDate, 'day') === 1) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    
    results.push({ endDate: currDate.toDate(), streak: currentStreak });
  }

  return results;
}

export function groupDutiesByCrew(duties: FlightDuty[]): Map<string, FlightDuty[]> {
  const map = new Map<string, FlightDuty[]>();
  for (const duty of duties) {
    if (!map.has(duty.crewMember)) {
      map.set(duty.crewMember, []);
    }
    map.get(duty.crewMember)!.push(duty);
  }
  return map;
}
