export type CrewRole = 'captain' | 'first_officer' | 'cabin';

export interface FlightDuty {
  flightNumber: string;
  crewMember: string;
  role: CrewRole;
  checkInTime: string;
  departureTime: string;
  arrivalTime: string;
  checkOutTime: string;
  departureTimezone?: number;
  arrivalTimezone?: number;
}

export interface DutyPeriod {
  crewMember: string;
  duties: FlightDuty[];
  checkInTime: Date;
  checkOutTime: Date;
  durationHours: number;
  flightHours: number;
  startDate: Date;
  endDate: Date;
}

export interface Violation {
  crewMember: string;
  flightNumber?: string;
  dutyPeriodIndex?: number;
  ruleId: string;
  ruleName: string;
  message: string;
  actualValue: number;
  limitValue: number;
  unit: string;
  excess: number;
}

export interface RulesConfig {
  maxDutyPeriodHours: number;
  minRestBetweenDutiesHours: number;
  maxFlightHours7Days: number;
  maxFlightHours28Days: number;
  maxConsecutiveDutyDays: number;
  timezoneCrossingThreshold: number;
  additionalRestPerTimezone: number;
  minRestAfterTimezoneCrossingHours: number;
}

export interface CrewSummary {
  crewMember: string;
  totalFlightHours: number;
  totalDutyHours: number;
  dutyPeriodCount: number;
  flightCount: number;
  firstDutyDate: string;
  lastDutyDate: string;
}

export type OutputFormat = 'json' | 'table';

export interface CheckResult {
  violations: Violation[];
  totalViolations: number;
  totalChecked: number;
}
