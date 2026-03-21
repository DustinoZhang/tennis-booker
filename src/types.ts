export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type BookingStatus =
  | "success"
  | "already_booked"
  | "unavailable"
  | "error";

export type Court = {
  readonly id: string;
  readonly name: string;
  readonly isDoubles: boolean;
};

export type SlotRequest = {
  readonly date: string; // YYYY-MM-DD
  readonly startTime: string; // HH:MM (24h)
  readonly durationMinutes: number; // 60, 90, or 120
};

export type TimeSlot = {
  readonly court: Court;
  readonly startTime: string; // HH:MM (24h)
  readonly endTime: string; // HH:MM (24h)
  readonly date: string; // YYYY-MM-DD
  readonly isAvailable: boolean;
};

export type BookingResult = {
  readonly status: BookingStatus;
  readonly message: string;
  readonly slot?: TimeSlot;
  readonly alternatives?: readonly TimeSlot[];
};
