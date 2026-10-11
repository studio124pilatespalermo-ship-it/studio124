/** Tipos del portal del cliente, según lo que devuelve /api/portal/*. */

export interface PortalConfig {
  readonly allowBooking: boolean;
  readonly allowSelfSignup: boolean;
  readonly showAvailableSlots: boolean;
  readonly showPayments: boolean;
  readonly allowOnlinePayment: boolean;
  readonly changeWindowHours: number;
  readonly cancelWindowHours: number;
  readonly timezoneNote: string;
}

export interface PortalClient {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  /** Idioma guardado en su ficha: define el portal y, más adelante, sus emails. */
  readonly locale: "es" | "en" | "pt";
}

export interface PortalBalance {
  readonly packId: string;
  readonly classesTotal: number;
  readonly remaining: number;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface PortalBooking {
  readonly id: string;
  readonly status: "booked" | "attended" | "absent" | "cancelled_on_time" | "cancelled_late";
  readonly date: string;
  readonly startTime: string;
  readonly durationMin: number;
}

export interface PortalSlot {
  readonly id: string;
  readonly date: string;
  readonly startTime: string;
  readonly durationMin: number;
  readonly free: number;
}

export interface PortalCategory {
  readonly id: string;
  readonly name: string;
  readonly classes: number;
  readonly validityDays: number;
  readonly priceMinor: number;
  readonly currency: string;
}
