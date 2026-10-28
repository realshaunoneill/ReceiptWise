# ReceiptWise design

One design for the website (`app/`, `components/`) and the app (`mobile/`). Colours have one source:
`app/globals.css`, which `npm run tokens` writes as hex to `shared/design/tokens.ts` for the app. A test fails
when the two disagree, so change a colour in the CSS, then run that.

## Principles

- **A tool for a household's money.** There's no landing-page decoration in the product: no gradients, glows,
  glass, emoji, sparkle badges, rainbow icons or per-tile colours. These were removed on purpose; don't add
  them back.
- **Green means "you can press this".** Primary green marks actions and the current place. Status colours
  (success, warning, destructive) mark state, never decoration. Success is deliberately a different green from
  primary, so a finished receipt never looks like a button.
- **Amounts come first.** Figures use tabular numbers, so columns line up. They're private: on the web, `.amount`
  and `data-private` keep them out of session recordings; in the app, "Hide amounts" covers widgets and
  notifications.
- **Plain words.** See [Copy](#copy).
- **Comfortable on a phone.** Tap targets are at least 44 pt. Every view works one-handed at phone width first.

## Colour

From `shared/design/tokens.ts` (generated):

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| background | `#ffffff` | `#090a0d` | the page or screen |
| card | `#ffffff` | `#15171b` | cards, grouped lists, sheets |
| foreground | `#0a0a0a` | `#eff3f6` | text |
| mutedForeground | `#737373` | `#878c92` | secondary text, small print |
| border | `#e5e5e5` | `#2f3239` | hairlines, card edges |
| primary | `#00825a` | `#00aa77` | buttons, links, the current tab, ticks |
| primaryForeground | `#ffffff` | `#090a0d` | text on primary (4.8:1 light, 6.6:1 dark) |
| success | `#14874e` | `#6cd092` | read, paid, done |
| warning | `#a36e09` | `#edbb64` | estimate, due soon, being read |
| destructive | `#e7000b` | `#e7000b` | failed, overdue, delete, over budget |
| info | `#2677b2` | `#6fb5ef` | neutral notices |

**Category tones** share one lightness and chroma and differ only in hue, so none shouts. Food, transport,
shopping, health, bills, leisure and neutral each map to an icon in `shared/receipts/categories.ts`. A
category badge is its tone as text, on a 10% tint, with a 20% border.

**Charts** use primary for bars and series; chart-2 to chart-5 only when a chart needs more than one series.

## Type

- **IBM Plex Sans** everywhere (400, 500, 600, 700). **IBM Plex Mono** for receipt and order numbers, the
  forwarding address, API keys and IDs: thermal-printer type, used sparingly.
- Amounts use tabular figures: `.amount` on the web, `<Amount>` in the app.
- The app loads each weight as its own family, because Android ignores `fontWeight` for custom fonts.

| Use | Web | App (pt, size/line) |
| --- | --- | --- |
| Page title | `text-2xl sm:text-3xl font-bold tracking-tight` | large title 32/38, 700 |
| Section title | `text-base font-semibold` | 18/24, 600 |
| Body | `text-sm`/`text-base` | 16/22, 400 |
| Small print, meta | `text-xs text-muted-foreground` | 13/18, 400, muted |
| Badge | `text-xs font-medium` | 12/16, 500 |
| Headline amount (Remaining) | `text-4xl font-semibold` | 40/44, 600 |
| Row amount | `font-semibold tabular-nums` | 16/22, 600 |

The app supports Dynamic Type up to the accessibility sizes: rows reflow rather than truncate amounts.

## Shape and space

- **Radius:** 8 is the base (`--radius`), with steps 4, 6, 8 and 12. Cards and sheets use 12; buttons and
  badges 6–8.
- **Spacing** is on a 4-point grid (4, 8, 12, 16, 24, 32), with a 16 pt screen gutter in the app.
- **Cards:**
  - web: a hairline border and `shadow-sm`
  - app: inset-grouped sections with a hairline border and no shadow, the way the platform does it
  - neither nests a card inside a card

## Components, web and app

| Web (shadcn/Radix) | App |
| --- | --- |
| Top navigation; a menu on phones | Native tabs: Home · Receipts · Plan · Bills · Settings |
| Page | A screen in a tab's stack, with a large title |
| Dialog (small edit) | `formSheet` with detents |
| Dialog (long form) | Modal with Cancel and Save |
| Detail modal (receipt, bill) | A pushed screen |
| DropdownMenu ("…") | Native context menu, plus swipe actions on rows |
| AlertDialog (delete) | Native Alert |
| Toast (sonner) | Inline status or a short toast, with a haptic |
| Skeleton | Skeleton that holds still under Reduce Motion |
| Badge | Pill |
| Checkbox in a plan line | The same tick, with the 44 pt target and a selection haptic |

**Empty states** are one sentence and one action, with an icon on a 10% primary tint at most. No illustrations.

## Copy

- Plain, sentence case, Irish English: "Transport", "Fuel", "itemised", "Direct debit", "payday to payday".
- Toasts are short and past tense: "Marked paid", "Skipped this time", "Saved", "Amount updated". No "…
  successfully", and no exclamation marks.
- **Money:**
  - `€1,234.56`, in the item's own currency, en-IE formatting
  - mixed currencies are joined ("€42.00 + $10.00"), never converted
  - "€X over" or "€X short before payday", never a minus sign
  - "~" marks an estimate, "—" a missing value
- **Dates:**
  - "21 Oct 2026", or "21 Oct" in the current year
  - ranges are "21 Oct – 20 Nov", with an en dash
  - nearby days are "Today", "Tomorrow", "In 3 days"
  - receipts are grouped under Today, Yesterday, the weekday, then the date
- " · " (a middle dot) separates parts of a line. Plurals are written out ("1 receipt", "2 receipts").
- On a phone, say "tap", not "click". Name the button the person will see.
- **One name for each thing, on the website and in the app** (settled in the 2026-10-28 review):
  - **Bills** is the page and the tab; an essential one is a *bill*, the rest are *subscriptions*.
    Links say "All bills". Only a subscription gets a kind pill.
  - **Households** (not "Sharing"); your own scope is **Just me**.
  - **Premium** is the paid plan; **Plan** only ever means the monthly plan.
  - **Sign out**, not "log out".
  - A plan's span is a **month** ("for November only"), never "period", even though it runs payday
    to payday.
  - Automatic payments **go out** ("Goes out today", in neutral); only a bill paid by hand is **Due**
    or **Overdue**, in amber or red.
  - **Bills to file** is the inbox while something waits; with nothing waiting it's **Bring in a bill**.
- Show a hint once: the Plan's "tap an amount" hint goes with How it works. Don't put a feature in
  front of people before they can use it (the extension's keys, phone notifications on the website).
- A first visit shows one thing to do: the Plan shows only "Start with your pay" until there is pay.

## Icons

- Lucide everywhere: `lucide-react` on the web, `lucide-react-native` in the app, with the same names (the
  category icons come from `shared/receipts/categories.ts`).
- Sizes: 16 inline, 20 in headers, 12 in badges. Icons are decorative (`aria-hidden`) unless they're the only
  label.
- The app's tab bar uses SF Symbols on iOS and Material Symbols on Android, as each platform expects. Lucide is
  everywhere else.

## Charts

- Bars in primary with the top corners rounded, a dashed grid in the border colour, and 12 pt axis labels in
  muted.
- Category breakdowns are plain horizontal bars.
- Spending going up shows in destructive, down in primary.
- Every chart has a text summary beside it for screen readers.
- The app draws charts with `react-native-svg`; there's no chart library.

## Motion and haptics

- Short and functional: 150–200 ms ease-out for sheets, expanding and fading.
- Nothing animates on a loop, and nothing moves under Reduce Motion beyond a fade.
- App haptics:
  - a selection tick when marking paid or done
  - success when a capture uploads
  - a warning on a failed upload
  - nothing on ordinary navigation

## Accessibility

- AA contrast or better. The tokens above already pass, so use them rather than new greys.
- 44 pt minimum targets. On the web, `TAP_TARGET` (`components/plan/labels.ts`) enlarges small controls.
- Every control has a label. In the app, amounts are read as currency and charts have summaries.
- In the app, sheets close with the platform's own gesture and keep focus order. Dynamic Type and VoiceOver are
  checked on every main screen before a release.

## The mark

- `brand/mark.svg`: a receipt, torn off at the bottom, read and ticked. Teal print (`#04756F`) on paper
  (`#F2EFEA`), with a green tick (`#2C9A6E`).
- Every icon, splash and favicon is drawn from that one file by `scripts/brand-assets.py` (needs
  `rsvg-convert` and Pillow); commit what it writes. Don't redraw it per platform. Approved 2026-10-27.
- Give it clear space of a quarter of its width.
- On dark backgrounds, use the dark variant (lighter teal and green on a near-black paper).
- Never recolour it to the UI primary, stretch it, outline it or put it on a busy image.
