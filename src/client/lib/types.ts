/** Tipos de la API, del lado del panel. Reflejan lo que devuelven las rutas. */

export interface PanelUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: "admin" | "staff";
}

export interface Client {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: "active" | "inactive";
  readonly notes: string | null;
  readonly createdAt: string;
}

export interface PackBalance {
  readonly packId: string;
  readonly clientId: string;
  readonly categoryId: string;
  readonly classesTotal: number;
  readonly used: number;
  readonly remaining: number;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: "pending" | "active" | "expired" | "cancelled";
}

export interface PackRow {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly categoryName: string;
  readonly methodName: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly classesTotal: number;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: string;
  readonly note: string | null;
}

export interface CreditMovement {
  readonly id: string;
  readonly packId: string;
  readonly delta: number;
  readonly reason: "loaded" | "booked" | "refunded" | "adjustment" | "expired";
  readonly note: string | null;
  readonly createdAt: string;
}

export interface PaymentCategory {
  readonly id: string;
  readonly name: string;
  readonly kind: "trial" | "single" | "single_duo" | "pack" | "monthly";
  readonly classes: number;
  readonly validityDays: number;
  readonly priceMinor: number;
  readonly currency: string;
  readonly sellOnline: boolean;
  readonly active: boolean;
  readonly sortOrder: number;
}

export interface PaymentMethod {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

export interface Professional {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

export interface Holiday {
  readonly id: string;
  readonly date: string;
  readonly name: string;
}

export interface TemplateSlot {
  readonly id: string;
  readonly weekday: number;
  readonly startTime: string;
  readonly durationMin: number;
  readonly capacity: number;
  readonly professionalId: string | null;
  readonly active: boolean;
}

export interface AgendaBooking {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly status: "booked" | "attended" | "absent" | "cancelled_on_time" | "cancelled_late";
  readonly source: "fixed" | "admin" | "client" | "change";
  readonly changedFromId: string | null;
  readonly packId: string;
}

export interface AgendaSlot {
  readonly id: string;
  readonly date: string;
  readonly startTime: string;
  readonly durationMin: number;
  readonly capacity: number;
  readonly professionalId: string | null;
  readonly status: "scheduled" | "cancelled";
  readonly taken: number;
  readonly bookings: AgendaBooking[];
}

export interface SecretStatus {
  readonly key: string;
  readonly label: string;
  readonly configured: boolean;
  readonly hint: string | null;
  readonly updatedAt: string | null;
}

export interface Settings {
  readonly "booking.changeWindowHours": number;
  readonly "booking.cancelWindowHours": number;
  readonly "booking.horizonDays": number;
  readonly "schedule.defaultDurationMin": number;
  readonly "schedule.defaultCapacity": number;
  readonly "portal.allowBooking": boolean;
  readonly "portal.allowSelfSignup": boolean;
  readonly "portal.showAvailableSlots": boolean;
  readonly "portal.showPayments": boolean;
  readonly "portal.allowOnlinePayment": boolean;
  readonly "staff.canMarkAttendance": boolean;
  readonly "notifications.expiryEmail": boolean;
  readonly "studio.name": string;
  readonly "studio.timezoneNote": string;
}

export interface SuggestedSlot {
  readonly slotId: string;
  readonly date: string;
  readonly startTime: string;
  readonly available: boolean;
  readonly reason?: string;
}
