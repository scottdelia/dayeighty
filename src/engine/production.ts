/* ===========================================================================
   THE PRODUCTION

   Invented, down to its title. The working title, the scenes, the characters,
   the contracts, the crew, the dates and the country belong to no book, no
   show and no company. What is borrowed is the shape of the problem, which
   was described in public by people who lived it: a crew of hundreds that
   does not exist one week and does the next, a fixed number of shoot days
   with none spare, and a production schedule on paper being re-sorted by
   hand when a day goes wrong. The source is cited once, in the README.

   The public numbers are kept because they were said aloud: seventy-nine
   days, eight episodes, about three hundred people. Every rate is a stated
   assumption. Dates are printed without a year.
   =========================================================================== */

export const PRODUCTION = {
  /** A working title. "(w/t)" is how a schedule marks one. */
  title: 'Far Bank',
  titleMark: 'Far Bank (w/t)',
  nature: 'an invented production',
  episodes: 8,
  shootDays: 79,
  /** Day 1, ISO. A Monday. Prep days count backward from it; there is no day 0. */
  day1: '2027-02-01',
  prepStartDay: -21,
  /** Shooting week is Monday to Saturday. Sunday is the rest day. */
  daysPerWeek: 6,
  crewTarget: 306,
  jurisdiction: 'a host country outside the US, not named',
} as const;

/* ---------------------------------------------------------------------------
   THE UNKNOWNS

   Every rate, cap and lead time the engines use is listed here and prefixed
   `assumed_`, so the naming itself resists the drift from "modeled scenario"
   to "finding". None of these figures has been published for this production
   and none was obtained from it. They are in the plausible range for a period
   drama of this scale shooting abroad, which is the most that can be said.
   --------------------------------------------------------------------------- */
export const ASSUMED = {
  /** Fully loaded daily cost of the whole unit: crew, equipment, trailers, catering. */
  assumed_unit_day_cost_cents: 18_000_000,
  /** Hours in a base day before overtime. */
  assumed_base_hours: 10,
  /** Multiplier on the hourly rate for hours 10 to 12. */
  assumed_ot_multiplier_1: 1.5,
  /** Multiplier beyond 12 hours. */
  assumed_ot_multiplier_2: 2.0,
  /** Hours between wrap and the next call before a penalty applies. */
  assumed_turnaround_hours: 11,
  /** Flat unit penalty for breaking turnaround, once. */
  assumed_forced_call_cents: 4_200_000,
  /** Script pages a unit can shoot in a base day, in eighths. Five pages. */
  assumed_day_capacity_eighths: 40,
  /** Eighths shot per hour. Half a page an hour: horses, period costume, extras. */
  assumed_eighths_per_hour: 4,
  /** Multiplier on the unit day cost for a seventh consecutive day. */
  assumed_seventh_day_multiplier: 2.0,
  /** Share of the unit day cost still paid when a day is canceled inside 24 hours. */
  assumed_canceled_day_pay_share: 1.0,
  /** Per background performer, per day. */
  assumed_extra_day_rate_cents: 25_000,
  /** Share of the day rate owed when background is canceled inside 48 hours. */
  assumed_extra_cancel_share_under_48h: 0.5,
  /** Per background performer, per overtime hour. */
  assumed_extra_ot_hour_cents: 3_500,
  /** Horse package for a mounted day: animals, wranglers, transport, farrier. */
  assumed_horse_package_day_cents: 1_400_000,
  /** Share owed when the horse package is canceled inside 48 hours. */
  assumed_horse_cancel_share_under_48h: 1.0,
  /** Water safety team, per day. */
  assumed_water_safety_day_cents: 180_000,
  /** Art department overnight to dress a set that needed two prep days. */
  assumed_overnight_dressing_cents: 2_600_000,
  /** Maximum hours a minor may be on set, including tuition and breaks. */
  assumed_minor_max_set_hours: 8,
  /** Latest a minor may wrap. */
  assumed_minor_latest_wrap: '21:00',
  /** Whether minors may work on the rest day. */
  assumed_minor_sundays: false,
  /** Hours a unit loses to a mid-day company move: wrap out, travel, set up. */
  assumed_company_move_hours: 1.5,
  /** Transport and reset cost of a mid-day company move. */
  assumed_company_move_cents: 650_000,
  /** A second unit day: a reduced crew, its own camera, doubles, no principals. */
  assumed_second_unit_day_cost_cents: 6_500_000,
  /** Pages a second unit shoots in a day, in eighths. Three pages. */
  assumed_second_unit_capacity_eighths: 24,
  /** Production days the second unit is contracted for. */
  assumed_second_unit_from_day: 40,
  assumed_second_unit_to_day: 66,
  /** A riding or stunt double, per day. */
  assumed_double_day_cents: 120_000,
  /** Hotel block overrun, per room per night, once the block ends. */
  assumed_hotel_overrun_room_night_cents: 14_000,
  /** Working days the office needs to close a time card dispute. */
  assumed_time_card_dispute_days: 10,
  /** Production incentive rate, if the host country's program applies. Not verified. */
  assumed_rebate_rate: 0.3,
} as const;

/** One line of plain English per assumption, for the panel that lists them. */
export const ASSUMPTION_NOTES: Record<keyof typeof ASSUMED, string> = {
  assumed_unit_day_cost_cents:
    'What one day of the whole unit costs, fully loaded. Nothing has been published for this production. $180,000 is in range for a period series of this scale shooting abroad.',
  assumed_base_hours: 'Ten hours before overtime. Varies by agreement and country; ten is common.',
  assumed_ot_multiplier_1: 'Time and a half for hours ten to twelve.',
  assumed_ot_multiplier_2: 'Double time beyond twelve.',
  assumed_turnaround_hours: 'Eleven hours between wrap and next call. Some agreements say ten, some twelve.',
  assumed_forced_call_cents: 'A single flat penalty for a broken turnaround. Real agreements compute it per person; a flat figure is a placeholder that is honest about being one.',
  assumed_day_capacity_eighths: 'Five pages a day. A period drama with horses and extras often manages less.',
  assumed_eighths_per_hour: 'Half a page an hour, which is what five pages in ten hours implies.',
  assumed_seventh_day_multiplier: 'Double time for a seventh consecutive day.',
  assumed_canceled_day_pay_share: 'Crew called inside 24 hours are paid whether or not they shoot.',
  assumed_extra_day_rate_cents: 'Background performer day rate, local.',
  assumed_extra_cancel_share_under_48h: 'Half a day owed when background is canceled inside 48 hours.',
  assumed_extra_ot_hour_cents: 'Background overtime, per hour, per performer.',
  assumed_horse_package_day_cents: 'Thirty-two horses with wranglers, transport and a farrier. Animal contracts rarely allow late cancellation.',
  assumed_horse_cancel_share_under_48h: 'The whole day, inside 48 hours.',
  assumed_water_safety_day_cents: 'A safety diver team for any scene with people in moving water.',
  assumed_overnight_dressing_cents: 'What it costs to do two days of set dressing in one night.',
  assumed_minor_max_set_hours: 'Eight hours on set for a child, including schooling. Varies sharply by country.',
  assumed_minor_latest_wrap: 'Nine at night. Varies by country and age.',
  assumed_minor_sundays: 'Whether a child may work on the rest day. Assumed not.',
  assumed_company_move_hours: 'Ninety minutes to wrap out of one location, drive, and be ready at the next. Optimistic with a horse package; fine without one.',
  assumed_company_move_cents: 'Fuel, drivers and a second catering set-up. Small next to the hours it costs.',
  assumed_second_unit_day_cost_cents: 'A second unit at about a third of the main unit. It exists on a period action series; whether it exists on this one is assumed.',
  assumed_second_unit_capacity_eighths: 'Three pages: wides, action, inserts. No dialogue, so it moves faster than the main unit.',
  assumed_second_unit_from_day: 'First day the second unit is contracted. Assumed to bracket the mounted blocks.',
  assumed_second_unit_to_day: 'Last day the second unit is contracted.',
  assumed_double_day_cents: 'A riding or stunt double for a principal, per day.',
  assumed_hotel_overrun_room_night_cents: 'Rack rate once the block booking ends.',
  assumed_time_card_dispute_days: 'How long the office takes to close a disputed time card after wrap.',
  assumed_rebate_rate: 'Several European programs pay around 30 percent of qualifying local spend. Which program applies, if any, is not known.',
};

/* ---------------------------------------------------------------------------
   DAYLIGHT

   Civil sunrise and sunset by month at roughly 47°N, from an almanac, not
   from the production. A dawn scene shoots at dawn wherever the unit is, so
   the call moves with the month.
   --------------------------------------------------------------------------- */

export const ASSUMED_DAYLIGHT: Record<number, { sunrise: string; sunset: string }> = {
  1: { sunrise: '07:25', sunset: '16:30' },
  2: { sunrise: '06:52', sunset: '17:10' },
  3: { sunrise: '05:46', sunset: '18:06' },
  4: { sunrise: '06:05', sunset: '19:40' },
  5: { sunrise: '05:25', sunset: '20:20' },
  6: { sunrise: '04:55', sunset: '20:50' },
};

export function daylightFor(day: number): { sunrise: string; sunset: string } {
  const month = new Date(`${dayToDate(day)}T00:00:00Z`).getUTCMonth() + 1;
  return ASSUMED_DAYLIGHT[month] ?? ASSUMED_DAYLIGHT[3]!;
}

/** Crew call for a dawn scene: an hour before sunrise, on the quarter hour. */
export function dawnCallFor(day: number): string {
  const min = hhmmToMinutes(daylightFor(day).sunrise) - 60;
  return minutesToHhmm(Math.floor(min / 15) * 15);
}

/* ---------------------------------------------------------------------------
   CALENDAR
   --------------------------------------------------------------------------- */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function addCalendarDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Production day to ISO date.
 *
 * Shoot days skip Sundays: day 6 is a Saturday, day 7 the following Monday.
 * Prep days are plain calendar days counted back from day 1, because prep
 * crews work whatever days the build needs. There is no day 0.
 */
export function dayToDate(day: number): string {
  if (day === 0) throw new Error('There is no day 0.');
  if (day < 0) return addCalendarDays(PRODUCTION.day1, day);
  const weeks = Math.floor((day - 1) / PRODUCTION.daysPerWeek);
  const dow = (day - 1) % PRODUCTION.daysPerWeek;
  return addCalendarDays(PRODUCTION.day1, weeks * 7 + dow);
}

/** The Sunday after a Saturday shoot day, as ISO, or null if the day is not a Saturday. */
export function restDayAfter(day: number): string | null {
  if (day < 1) return null;
  const dow = (day - 1) % PRODUCTION.daysPerWeek;
  if (dow !== PRODUCTION.daysPerWeek - 1) return null;
  return addCalendarDays(dayToDate(day), 1);
}

export function isFirstDayAfterRest(day: number): boolean {
  return day >= 1 && (day - 1) % PRODUCTION.daysPerWeek === 0;
}

export function weekdayOf(iso: string): string {
  return WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()]!;
}

export function weekdayOfDay(day: number): string {
  return weekdayOf(dayToDate(day));
}

/** "Thu Mar 25" */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Thursday, March 25". No year: the calendar is invented and a year would make it look otherwise. */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  const mo = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][d.getUTCMonth()];
  return `${wd}, ${mo} ${d.getUTCDate()}`;
}

export function calendarDaysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Calendar days from one production day to another. */
export function daysBetweenDays(fromDay: number, toDay: number): number {
  return calendarDaysBetween(dayToDate(fromDay), dayToDate(toDay));
}

/** "Day 46" / "Day −3" */
export function dayLabel(day: number): string {
  return day < 0 ? `Day −${Math.abs(day)}` : `Day ${day}`;
}

/* ---------------------------------------------------------------------------
   TIME OF DAY
   --------------------------------------------------------------------------- */

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToHhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * "6:10 PM". The engine keeps HH:MM (24h) internally, because it sorts and
 * subtracts them; every time a person reads goes through here.
 */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h ?? 0;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

/* ---------------------------------------------------------------------------
   THE THREE MOMENTS

   Each view is pinned to one moment in the life of the production, stated on
   screen. A demo whose findings drift with the reader's clock is not
   reproducible; this one is.
   --------------------------------------------------------------------------- */

export const MOMENTS = {
  crewUp: { day: -7, time: '18:00', label: 'One week to Day 1' },
  lostDay: { day: 46, time: '18:10', label: 'The call sheet is due at 20:00' },
  wrap: { day: 79, time: '22:40', label: 'Wrap is called' },
} as const;
