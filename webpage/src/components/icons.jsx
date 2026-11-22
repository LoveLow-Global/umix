// Line icons used across the app.
const svg = (d, size = 20, extra = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{d}</svg>
)
export const I = {
  search: svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, 20),
  plus: svg(<path d="M12 5v14M5 12h14" />, 18),
  check: svg(<path d="m5 12.5 4.5 4.5L19 7" />, 16, { strokeWidth: 2.6 }),
  x: svg(<path d="M6 6l12 12M18 6 6 18" />, 16),
  back: svg(<path d="M15 5l-7 7 7 7" />, 20),
  next: svg(<path d="M9 5l7 7-7 7" />, 18),
  map: svg(<><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="9" r="2.5" /><circle cx="11" cy="18" r="2.5" /><path d="M8.3 8 Q13 6 15.6 8.4M7 9.3 Q8 14 9.6 16M16.8 11.2 Q15 15 13.3 16.9" /></>, 22),
  spark: svg(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8" /></>, 22),
  user: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>, 22),
}
