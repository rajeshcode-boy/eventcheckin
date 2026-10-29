// Hand-maintained public holidays for countries that the holiday API does not cover.
// Sources: BankBazaar, Zimyo, Eskimo Travel and FactoHR (India); Wego, ZenHR and Hono.ai (Saudi Arabia).
// Lunar holidays (Eid, Holi, Diwali, Dussehra, Arafat) move with the moon and can differ by a day
// between sources; they are marked tentative. Confirm against official notices before relying on them.
// Update this list each year.

export interface CuratedHoliday {
  date: string // YYYY-MM-DD
  name: string
  tentative?: boolean
}

export const CURATED_HOLIDAYS: Record<string, CuratedHoliday[]> = {
  IN: [
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-03-04', name: 'Holi', tentative: true },
    { date: '2026-03-21', name: 'Eid al-Fitr', tentative: true },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-27', name: 'Eid al-Adha (Bakrid)', tentative: true },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra', tentative: true },
    { date: '2026-11-08', name: 'Diwali', tentative: true },
    { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
    { date: '2026-12-25', name: 'Christmas Day' },
  ],
  SA: [
    { date: '2026-02-22', name: 'Founding Day' },
    { date: '2026-03-20', name: 'Eid al-Fitr', tentative: true },
    { date: '2026-05-26', name: 'Arafat Day', tentative: true },
    { date: '2026-05-27', name: 'Eid al-Adha', tentative: true },
    { date: '2026-09-23', name: 'National Day' },
  ],
}
