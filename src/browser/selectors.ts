// ---------------------------------------------------------------------------
// CSS / Playwright selectors grouped by page.
// All values are readonly constants — never mutate.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------
export const LOGIN = {
  /** Text input associated with the "Email" label */
  EMAIL_INPUT: "input[placeholder='Enter Your Email'], input[type='email'], #Email",

  /** Text input associated with the "Password" label */
  PASSWORD_INPUT: "input[placeholder='Enter Your Password'], input[type='password'], #Password",

  /** The "Continue" submit button (not "Continue with Google") */
  CONTINUE_BUTTON: "button[data-testid='Continue'], button[type='submit']:has-text('Continue')",
} as const;

// ---------------------------------------------------------------------------
// Availability grid page
// ---------------------------------------------------------------------------
export const GRID = {
  /** "TODAY" navigation button */
  TODAY_BUTTON: "button:has-text('TODAY')",

  /** Left arrow — navigate to previous day */
  PREV_DAY_BUTTON: "button[aria-label='Previous day'], .k-nav-prev, button:has-text('<')",

  /** Right arrow — navigate to next day */
  NEXT_DAY_BUTTON: "button[aria-label='Next day'], .k-nav-next, button:has-text('>')",

  /** Date picker / calendar dropdown */
  DATE_PICKER: "input[aria-label='Date picker'], .k-datepicker input, [data-role='datepicker'] input",

  /**
   * Court column headers — contain text like "Court #1 (Singles Court)" or "Court #2".
   * Use .filter({ hasText: /Court #\d/ }) to select a specific court.
   */
  COURT_HEADER: ".k-scheduler-head th, .scheduler-column-header, [data-court-header]",

  /** Available (white/empty) grid cells — clickable to open booking modal */
  AVAILABLE_CELL: ".k-scheduler-cell:not(:has-text('Reserved')):not(.k-nonwork-hour), .available-slot",

  /** Reserved (gray) grid cells — not clickable */
  RESERVED_CELL: ".k-scheduler-cell:has-text('Reserved'), .reserved-slot",

  /** "Reserve" buttons at the bottom of available columns */
  RESERVE_BUTTON: "button:has-text('Reserve')",
} as const;

// ---------------------------------------------------------------------------
// Booking modal
// ---------------------------------------------------------------------------
export const MODAL = {
  /** Modal title — contains "Book a reservation for" */
  TITLE: ".modal-title:has-text('Book a reservation for'), [data-modal-title]:has-text('Book a reservation for')",

  /** Reservation Type dropdown */
  RESERVATION_TYPE_DROPDOWN: "label:has-text('Reservation Type') + select, select[name*='ReservationType'], #ReservationType",

  /** Duration dropdown */
  DURATION_DROPDOWN: "label:has-text('Duration') + select, select[name*='Duration'], #Duration",

  /** Disclosure agreement checkbox */
  DISCLOSURE_CHECKBOX: "input[type='checkbox']:near(:text('Check to agree to above disclosure')), label:has-text('Check to agree to above disclosure') input[type='checkbox']",

  /** Save button (blue) */
  SAVE_BUTTON: "button:has-text('Save')",

  /** Close button */
  CLOSE_BUTTON: "button:has-text('Close')",
} as const;

// ---------------------------------------------------------------------------
// My Reservations page
// ---------------------------------------------------------------------------
export const MY_RESERVATIONS = {
  /** "Active" tab — shows upcoming/active bookings */
  ACTIVE_TAB: "a:has-text('Active'), button:has-text('Active'), [role='tab']:has-text('Active')",

  /** "Cancelled" tab */
  CANCELLED_TAB: "a:has-text('Cancelled'), button:has-text('Cancelled'), [role='tab']:has-text('Cancelled')",

  /** Date filter radio — "Today" */
  DATE_FILTER_TODAY: "input[type='radio']:near(:text('Today')), label:has-text('Today') input[type='radio']",

  /** Date filter radio — "Tomorrow" */
  DATE_FILTER_TOMORROW: "input[type='radio']:near(:text('Tomorrow')), label:has-text('Tomorrow') input[type='radio']",

  /** Date filter radio — "Next 7 Days" */
  DATE_FILTER_NEXT_7: "input[type='radio']:near(:text('Next 7 Days')), label:has-text('Next 7 Days') input[type='radio']",

  /** Date filter radio — "Next 30 Days" */
  DATE_FILTER_NEXT_30: "input[type='radio']:near(:text('Next 30 Days')), label:has-text('Next 30 Days') input[type='radio']",

  /**
   * Booking cards — each card contains court number, date/time, and player name.
   * Use .filter({ hasText: /Court #\d/ }) to narrow to a specific court.
   */
  BOOKING_CARD: ".booking-card, .reservation-card, [data-reservation-id]",

  /** "Edit Reservation" button inside a booking card */
  EDIT_RESERVATION_BUTTON: "button:has-text('Edit Reservation'), a:has-text('Edit Reservation')",

  /** Navigation element or link confirming the user is logged in */
  BOOK_A_COURT_LINK: "a:has-text('Book a Court'), nav a:has-text('Book')",
} as const;

// ---------------------------------------------------------------------------
// Payment page (appears after booking Save)
// ---------------------------------------------------------------------------
export const PAYMENT = {
  /** Total due amount text */
  TOTAL_DUE: "text='TOTAL DUE' >> .., :has-text('TOTAL DUE')",

  /** Payment method dropdown (pre-filled with saved card) */
  PAYMENT_METHOD_DROPDOWN: "select:near(:text('Payment Method')), label:has-text('Payment Method') + select, select[name*='Payment'], select[name*='payment']",

  /** Pay button */
  PAY_BUTTON: "button:has-text('Pay')",

  /** View Cart button */
  VIEW_CART_BUTTON: "button:has-text('View Cart'), a:has-text('View Cart')",
} as const;
