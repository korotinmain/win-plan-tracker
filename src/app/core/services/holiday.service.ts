import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { parseISO, addDays, format } from 'date-fns';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export interface NagerCountry {
  countryCode: string;
  name: string;
}

export interface PublicHoliday {
  /** Calendar date of the holiday (may fall on a weekend) */
  date: string;
  /** Workday that is treated as day-off: Mon if holiday is Sat/Sun, otherwise same as date */
  observed: string;
  name: string;
}

const BASE = 'https://date.nager.at/api/v3';

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private http = inject(HttpClient);
  private holidayCache = new Map<string, PublicHoliday[]>();
  private countriesCache: NagerCountry[] | null = null;

  async getCountries(): Promise<NagerCountry[]> {
    if (this.countriesCache) return this.countriesCache;
    const list = await firstValueFrom(
      this.http.get<NagerCountry[]>(`${BASE}/AvailableCountries`),
    );
    this.countriesCache = list.sort((a, b) => a.name.localeCompare(b.name));
    return this.countriesCache;
  }

  async getPublicHolidays(
    year: number,
    countryCode: string,
  ): Promise<PublicHoliday[]> {
    const key = `${year}_${countryCode}`;
    if (this.holidayCache.has(key)) return this.holidayCache.get(key)!;

    const raw = await firstValueFrom(
      this.http.get<NagerHoliday[]>(
        `${BASE}/PublicHolidays/${year}/${countryCode}`,
      ),
    );

    const result = raw.map((h) => {
      const d = parseISO(h.date);
      const dow = d.getDay(); // 0 = Sun, 6 = Sat
      let observed = h.date;
      if (dow === 6) observed = format(addDays(d, 2), 'yyyy-MM-dd'); // Sat → Mon
      if (dow === 0) observed = format(addDays(d, 1), 'yyyy-MM-dd'); // Sun → Mon
      return { date: h.date, observed, name: h.localName || h.name };
    });

    this.holidayCache.set(key, result);
    return result;
  }
}
