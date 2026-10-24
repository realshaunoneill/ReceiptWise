import { describe, expect, it } from 'vitest';
import { computePlan, type EntryLike, type IncomeLike, type PaymentLike, type PlanInput, type RecurringLike } from './compute-plan';
import { periodContaining } from '@/lib/schedule/pay-schedule';

const at = (day: string) => new Date(`${day}T00:00:00.000Z`);
const owner = { userId: 'megan', householdId: null };

const salary: IncomeLike = {
  id: 'salary', name: 'Salary', amount: '3820', currency: 'EUR', isPrimary: true, status: 'active', intoAccountId: null,
  frequency: 'monthly', payDay: 1, anchorDate: null, weekendRule: 'none', ...owner,
};

function bill(id: string, name: string, amount: string, billingDay: number, extra: Partial<RecurringLike> = {}): RecurringLike {
  return {
    id, name, kind: 'bill', category: null, amount, amountType: 'fixed', currency: 'EUR', status: 'active',
    paymentMethod: 'direct_debit', paidFromAccountId: null, billingFrequency: 'monthly', billingDay,
    customFrequencyDays: null, startDate: at('2026-01-01'), endDate: null, ...owner, ...extra,
  };
}

function row(id: string, cycle: string, expectedAmount: string, extra: Partial<PaymentLike> = {}): PaymentLike {
  return {
    id, expectedDate: at(cycle), dueDate: null, expectedAmount, amountSource: 'manual', currency: null,
    status: 'pending', actualDate: null, actualAmount: null, paidVia: null, ...extra,
  };
}

function entry(id: string, date: string, label: string, amount: string, extra: Partial<EntryLike> = {}): EntryLike {
  return { id, date, label, amount, currency: 'EUR', direction: 'out', category: null, doneAt: null, ...owner, ...extra };
}

/** Megan's sheet: the same recurring lines every month, with rent and the card varying. */
function megan(today: string, overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    today,
    period: periodContaining(salary, today),
    currency: 'EUR',
    incomes: [salary],
    recurring: [
      {
        subscription: bill('rent', 'Rent', '150', 1, { amountType: 'variable' }),
        payments: [row('rent-nov', '2026-11-01', '150'), row('rent-dec', '2026-12-01', '300')],
        recentPaidAmounts: [],
      },
      { subscription: bill('car', 'Car', '469', 5), payments: [], recentPaidAmounts: [] },
      { subscription: bill('insurance', 'Insurance', '57', 10), payments: [], recentPaidAmounts: [] },
      { subscription: bill('phone', 'Phone', '20', 12), payments: [], recentPaidAmounts: [] },
      {
        subscription: bill('card', 'Card', '0', 20, { amountType: 'variable', paymentMethod: 'manual' }),
        payments: [row('card-nov', '2026-11-20', '547', { amountSource: 'bill' }), row('card-dec', '2026-12-20', '0')],
        recentPaidAmounts: [],
      },
    ],
    entries: [
      entry('e1', '2026-11-01', 'Rent first half of Nov', '70'),
      entry('e2', '2026-11-01', 'Living money Oct', '52'),
      entry('e3', '2026-11-01', 'Dress', '85'),
      entry('e4', '2026-11-01', 'Living money', '220'),
      entry('e5', '2026-11-01', 'Niamhs wedding', '400'),
      entry('e6', '2026-11-01', 'Petrol and rolls', '115'),
      entry('e7', '2026-12-01', 'Rent first half of Nov', '150'),
      entry('e8', '2026-12-01', 'Living money Oct', '150'),
      entry('e9', '2026-12-01', 'Trip', '450'),
    ],
    goals: [{
      goal: { id: 'savings', name: 'Savings', targetAmount: null, currency: 'EUR', targetDate: null, contributionPerCycle: '1500', savedAmount: '0', status: 'active', ...owner },
      contributions: [],
    }],
    accounts: [],
    ...overrides,
  };
}

describe('computePlan: the monthly sheet', () => {
  it("reproduces Megan's November: 3,820 in, 3,685 out, 135 remaining, 33.75 a week", () => {
    const plan = computePlan(megan('2026-11-10'));
    expect(plan.period).toMatchObject({ start: '2026-11-01', end: '2026-12-01', label: 'November 2026', weeks: 4 });
    expect(plan.totals).toMatchObject({ incomeCents: 382000, outgoingCents: 368500, remainingCents: 13500, weeklyCents: 3375 });
    expect(plan.lines.filter((l) => l.direction === 'out')).toHaveLength(12);
  });

  it("reproduces Megan's December: 724 remaining, 181 a week", () => {
    const plan = computePlan(megan('2026-12-10'));
    expect(plan.period.label).toBe('December 2026');
    expect(plan.totals).toMatchObject({ outgoingCents: 309600, remainingCents: 72400, weeklyCents: 18100 });
  });

  it('plans a future month from the recurring lines alone', () => {
    const plan = computePlan(megan('2026-11-10', { period: periodContaining(salary, '2027-04-10') }));
    expect(plan.period.label).toBe('April 2027');
    // rent (usual 150, no bill yet) + car + insurance + phone + card (usual 0) + savings
    expect(plan.totals.outgoingCents).toBe(15000 + 46900 + 5700 + 2000 + 0 + 150000);
    expect(plan.lines.find((l) => l.label === 'Rent')).toMatchObject({ estimated: true, paymentId: null, cycleDate: '2027-04-01' });
    expect(plan.daysLeft).toBeNull();
  });

  it('uses the average of recent payments for a variable bill with no figure yet', () => {
    const input = megan('2026-11-10');
    input.recurring[0] = {
      subscription: bill('elec', 'Electricity', '100', 15, { amountType: 'variable' }),
      payments: [],
      recentPaidAmounts: ['90', '110', '130', '500'],
    };
    const line = computePlan(input).lines.find((l) => l.label === 'Electricity')!;
    expect(line).toMatchObject({ amountCents: 11000, estimated: true });
    expect(computePlan(input).flags).toContain('estimates');
  });

  it('shows paid lines at what was paid, and leaves skipped and other-currency lines out of the totals', () => {
    const input = megan('2026-11-10');
    input.recurring[1].payments = [row('car-nov', '2026-11-05', '469', {
      status: 'paid', actualAmount: '470', actualDate: at('2026-11-05'), paidVia: 'assumed', amountSource: 'estimate',
    })];
    input.recurring[2].payments = [row('ins-nov', '2026-11-10', '57', { status: 'skipped' })];
    input.entries.push(entry('usd', '2026-11-03', 'App', '10', { currency: 'USD' }));
    const plan = computePlan(input);
    expect(plan.lines.find((l) => l.label === 'Car')).toMatchObject({ status: 'paid', amountCents: 47000, paidVia: 'assumed' });
    expect(plan.lines.find((l) => l.label === 'Insurance')).toMatchObject({ counted: false, notCountedReason: 'skipped' });
    expect(plan.lines.find((l) => l.label === 'App')).toMatchObject({ counted: false, notCountedReason: 'other_currency' });
    expect(plan.totals.outgoingCents).toBe(368500 + 100 - 5700);
    expect(plan.flags).toContain('other_currency');
  });

  it("puts a bill in the period of its due date, and keeps a cycle's row from being projected twice", () => {
    const input = megan('2026-11-10');
    // November's car payment is due on 2 December: it moves to December's sheet.
    input.recurring[1].payments = [row('car-nov', '2026-11-05', '469', { dueDate: '2026-12-02', amountSource: 'bill' })];
    const november = computePlan(input);
    expect(november.lines.filter((l) => l.label === 'Car')).toHaveLength(0);
    const december = computePlan({ ...input, today: '2026-12-10', period: periodContaining(salary, '2026-12-10') });
    expect(december.lines.filter((l) => l.label === 'Car').map((l) => l.date)).toEqual(['2026-12-02', '2026-12-05']);
  });

  it('marks a manual bill overdue past the grace period, never a direct debit', () => {
    const plan = computePlan(megan('2026-11-28'));
    expect(plan.lines.find((l) => l.label === 'Card')!.status).toBe('overdue');
    expect(plan.lines.find((l) => l.label === 'Car')!.status).toBe('planned');
    expect(plan.flags).toContain('overdue');
  });

  it('never marks a card subscription overdue: it is charged automatically', () => {
    const input = megan('2026-11-28');
    input.recurring.push({
      subscription: bill('netflix', 'Netflix', '17.99', 3, { kind: 'subscription', paymentMethod: 'card' }),
      payments: [row('netflix-nov', '2026-11-03', '17.99', { amountSource: 'estimate' })],
      recentPaidAmounts: [],
    });
    input.recurring.push({
      subscription: bill('icloud', 'iCloud+', '2.99', 11, { kind: 'subscription', paymentMethod: 'card' }),
      payments: [],
      recentPaidAmounts: [],
    });
    const plan = computePlan(input);
    expect(plan.lines.find((l) => l.label === 'Netflix')!.status).toBe('planned');
    expect(plan.lines.find((l) => l.label === 'iCloud+')!.status).toBe('planned');

    // The daily job used to mark card charges missed: those aren't overdue either.
    input.recurring.at(-2)!.payments = [row('netflix-nov', '2026-11-03', '17.99', { status: 'missed' })];
    expect(computePlan(input).lines.find((l) => l.label === 'Netflix')!.status).toBe('planned');
    // A manual one and one that never said still go overdue.
    expect(plan.lines.find((l) => l.label === 'Card')!.status).toBe('overdue');
  });

  it('counts a done goal at what was contributed, and tracks the target', () => {
    const input = megan('2026-11-10');
    input.goals[0] = {
      goal: { ...input.goals[0].goal, targetAmount: '20000', savedAmount: '5000', targetDate: '2027-11-01' },
      contributions: [{ id: 'c1', goalId: 'savings', amount: '1200', contributedOn: '2026-11-02' }],
    };
    const plan = computePlan(input);
    expect(plan.lines.find((l) => l.source === 'goal')).toMatchObject({ amountCents: 120000, status: 'done' });
    expect(plan.goals[0]).toMatchObject({ savedCents: 500000, targetCents: 2000000, onTrack: true });
  });

  it("leaves this period out of a goal's months to go once its contribution is in", () => {
    const input = megan('2026-11-10');
    // 1 November to 1 August is 9 months: 17,500 ÷ 9 before; once 1,500 is put in this month,
    // 16,000 is left over the 8 months after it.
    const goal = { ...input.goals[0].goal, targetAmount: '17500', targetDate: '2027-08-01', savedAmount: '0' };
    input.goals[0] = { goal, contributions: [] };
    expect(computePlan(input).goals[0].neededPerCycleCents).toBe(194445);

    input.goals[0] = {
      goal: { ...goal, savedAmount: '1500' },
      contributions: [{ id: 'c1', goalId: 'savings', amount: '1500', contributedOn: '2026-11-10' }],
    };
    expect(computePlan(input).goals[0]).toMatchObject({ savedCents: 150000, neededPerCycleCents: 200000, onTrack: false });
  });

  it("uses a linked savings account's balance as what a goal has saved", () => {
    const savingsAccount = {
      id: 'rainy', name: 'Rainy day', kind: 'savings', currency: 'EUR', includeInPlan: false, archivedAt: null,
      latestBalance: { balance: '5000', asOfDate: '2026-11-05', recordedAt: '2026-11-05T09:00:00.000Z' },
    };
    const input = megan('2026-11-10', { accounts: [savingsAccount] });
    input.goals[0] = {
      goal: { ...input.goals[0].goal, savedAmount: '700', linkedAccountId: 'rainy', targetAmount: '20000' },
      contributions: [
        // Before the balance was typed in: already in it. After: not yet.
        { id: 'c0', goalId: 'savings', amount: '300', contributedOn: '2026-11-05', createdAt: '2026-11-05T08:00:00.000Z' },
        { id: 'c1', goalId: 'savings', amount: '1200', contributedOn: '2026-11-08', createdAt: '2026-11-08T08:00:00.000Z' },
      ],
    };
    expect(computePlan(input).goals[0]).toMatchObject({
      savedCents: 500000 + 120000,
      linkedAccount: { id: 'rainy', name: 'Rainy day', asOfDate: '2026-11-05' },
    });

    // Without a balance (or in another currency), the typed-in figure.
    const noBalance = megan('2026-11-10', { accounts: [{ ...savingsAccount, latestBalance: null }] });
    noBalance.goals[0] = { goal: { ...input.goals[0].goal }, contributions: [] };
    expect(computePlan(noBalance).goals[0]).toMatchObject({ savedCents: 70000, linkedAccount: null });
  });

  it('flags a missing income and falls back to the calendar month', () => {
    const plan = computePlan(megan('2026-11-10', { incomes: [], period: periodContaining(null, '2026-11-10') }));
    expect(plan.flags).toContain('no_income');
    expect(plan.totals.incomeCents).toBe(0);
    expect(plan.period.calendarMonth).toBe(true);
  });
});

describe('computePlan: a payday moved by the weekend', () => {
  // The staging household: paid on the 25th, the Friday before when that is a weekend. 25 October
  // 2026 is a Sunday, so November's money comes on Friday the 23rd.
  const pay25: IncomeLike = { ...salary, payDay: 25, weekendRule: 'previous_business_day' };
  const sheet = (today: string, overrides: Partial<PlanInput> = {}): PlanInput => ({
    today,
    period: periodContaining(pay25, today),
    currency: 'EUR',
    incomes: [pay25],
    recurring: [
      { subscription: bill('gym', 'Gym', '40', 24), payments: [], recentPaidAmounts: [] },
      { subscription: bill('bins', 'Bins', '25', 23, { paymentMethod: 'manual' }), payments: [], recentPaidAmounts: [] },
      { subscription: bill('rent', 'Rent', '1200', 1), payments: [], recentPaidAmounts: [] },
    ],
    entries: [],
    goals: [],
    accounts: [],
    ...overrides,
  });
  const datesOf = (input: PlanInput, label: string) => computePlan(input).lines.filter((l) => l.label === label).map((l) => l.date);

  it('shows a bill on the 23rd or 24th once in November and once in October', () => {
    const november = sheet('2026-11-10');
    expect(november.period).toMatchObject({ start: '2026-10-23', end: '2026-11-25', label: 'November 2026' });
    expect(datesOf(november, 'Gym')).toEqual(['2026-11-24']);
    expect(datesOf(november, 'Bins')).toEqual(['2026-11-23']);
    expect(datesOf(november, 'Rent')).toEqual(['2026-11-01']);
    expect(datesOf(november, 'Salary')).toEqual(['2026-10-23']);

    const october = sheet('2026-10-10');
    expect(october.period).toMatchObject({ start: '2026-09-25', end: '2026-10-23', label: 'October 2026' });
    expect(datesOf(october, 'Gym')).toEqual(['2026-10-24']);
    expect(datesOf(october, 'Bins')).toEqual(['2026-10-23']);
    expect(datesOf(october, 'Salary')).toEqual(['2026-09-25']);
  });

  it('keeps a row that exists for the 24th in its own month too', () => {
    const input = sheet('2026-11-10');
    input.recurring[0].payments = [
      row('gym-oct', '2026-10-24', '40', { status: 'paid', actualAmount: '40', actualDate: at('2026-10-27'), paidVia: 'assumed' }),
      row('gym-nov', '2026-11-24', '40'),
    ];
    expect(datesOf(input, 'Gym')).toEqual(['2026-11-24']);
    expect(datesOf({ ...input, today: '2026-10-10', period: periodContaining(pay25, '2026-10-10') }, 'Gym')).toEqual(['2026-10-24']);
  });

  it("still takes October's late bills off the money left until November's payday", () => {
    // Balance typed on Friday 23 October, payday. The gym direct debit due Saturday the 24th is
    // collected on Tuesday the 27th (the Monday is a bank holiday): it is on October's sheet, but
    // the money hasn't gone yet.
    const input = sheet('2026-10-24', {
      accounts: [{ id: 'current', name: 'Current', kind: 'current', currency: 'EUR', includeInPlan: true, archivedAt: null, latestBalance: { balance: '4000', asOfDate: '2026-10-23' } }],
    });
    const plan = computePlan(input);
    expect(plan.lines.filter((l) => l.label === 'Gym').map((l) => l.date)).toEqual(['2026-11-24']);
    // Out before payday: gym 24 Oct and 24 Nov, rent 1 Nov, and bins on 23 Oct and 23 Nov
    // (paid by hand, and not yet marked paid, so still owed).
    expect(plan.balance!.outgoingCents).toBe(4000 + 4000 + 120000 + 2500 + 2500);
    expect(plan.balance!.incomingCents).toBe(0);
  });
});

describe('computePlan: left until payday from the bank balance', () => {
  const current = (balance: string, asOfDate: string) => ({
    id: 'current', name: 'Current', kind: 'current', currency: 'EUR', includeInPlan: true, archivedAt: null,
    latestBalance: { balance, asOfDate },
  });

  it('counts what goes out after the balance date, and assumes earlier direct debits are gone', () => {
    // Balance on 10 Nov. Rent (1st) and car (5th) are direct debits before it: assumed gone.
    // Insurance (DD, 10th) is on the balance day itself: in the balance. Phone (12th) and the
    // card (20th) are still to come, and so are every one-off and the savings set-aside.
    const plan = computePlan(megan('2026-11-10', { accounts: [current('2500', '2026-11-10')] }));
    expect(plan.balance).not.toBeNull();
    const view = plan.balance!;
    expect(view.assumedOutKeys.sort()).toEqual(['sub:car:2026-11-05', 'sub:insurance:2026-11-10', 'sub:rent:2026-11-01'].sort());
    expect(view.outgoingCents).toBe(2000 + 54700 + 94200 + 150000);
    expect(view.incomingCents).toBe(0);
    expect(view.availableCents).toBe(250000 - (2000 + 54700 + 94200 + 150000));
    expect(view.daysLeft).toBe(21);
  });

  it('adds the payday when the balance is from before it, and a payment made after the balance', () => {
    const input = megan('2026-11-10', { accounts: [current('300', '2026-10-30')] });
    input.recurring[1].payments = [row('car-nov', '2026-11-05', '469', {
      status: 'paid', actualAmount: '469', actualDate: at('2026-11-05'), paidVia: 'manual',
    })];
    const view = computePlan(input).balance!;
    expect(view.incomingCents).toBe(382000);
    // car paid on the 5th, after the 30 Oct balance, still has to come off it
    expect(view.outgoingCents).toBeGreaterThanOrEqual(46900);
    expect(computePlan(input).flags).toContain('stale_balance');
  });

  it('assumes a card charge before the balance has gone, on the day itself', () => {
    const input = megan('2026-11-10', { accounts: [current('2500', '2026-11-07')] });
    // Saturday 7 November: a card is charged that day, a direct debit on the Monday.
    input.recurring.push(
      { subscription: bill('netflix', 'Netflix', '17.99', 7, { paymentMethod: 'card' }), payments: [], recentPaidAmounts: [] },
      { subscription: bill('gym', 'Gym', '40', 7), payments: [], recentPaidAmounts: [] },
    );
    const view = computePlan(input).balance!;
    expect(view.assumedOutKeys).toContain('sub:netflix:2026-11-07');
    expect(view.assumedOutKeys).not.toContain('sub:gym:2026-11-07');
  });

  it('shows a shortfall with nothing to split a week or a day', () => {
    const view = computePlan(megan('2026-11-10', { accounts: [current('100', '2026-11-10')] })).balance!;
    expect(view.availableCents).toBeLessThan(0);
    expect(view.perWeekCents).toBeNull();
    expect(view.perDayCents).toBeNull();
    const fine = computePlan(megan('2026-11-10', { accounts: [current('5000', '2026-11-10')] })).balance!;
    expect(fine.perWeekCents).toBe(Math.floor((fine.availableCents * 7) / 21));
  });

  it('keeps something ticked off after the balance was typed in that day coming off it', () => {
    const balance = { ...current('2500', '2026-11-10'), latestBalance: { balance: '2500', asOfDate: '2026-11-10', recordedAt: '2026-11-10T09:00:00.000Z' } };
    const withFood = (doneAt: Date | null) => {
      const input = megan('2026-11-10', { accounts: [balance] });
      input.entries.push(entry('food', '2026-11-01', 'Food shop', '320', { doneAt }));
      return computePlan(input).balance!.availableCents;
    };
    const before = withFood(null);
    // Ticked at noon, after the 9am balance: the balance doesn't show it, so nothing changes.
    expect(withFood(new Date('2026-11-10T12:00:00.000Z'))).toBe(before);
    // Ticked at 8am, before the balance: it's already in it.
    expect(withFood(new Date('2026-11-10T08:00:00.000Z'))).toBe(before + 32000);
  });

  it('does the same for a bill marked paid on the balance day', () => {
    const balance = { ...current('2500', '2026-11-10'), latestBalance: { balance: '2500', asOfDate: '2026-11-10', recordedAt: '2026-11-10T09:00:00.000Z' } };
    const phonePaid = (updatedAt: string) => {
      const input = megan('2026-11-10', { accounts: [balance] });
      input.recurring[3].payments = [row('phone-nov', '2026-11-12', '20', {
        status: 'paid', actualAmount: '20', actualDate: at('2026-11-10'), paidVia: 'manual', updatedAt,
      })];
      return computePlan(input).balance!.outgoingCents;
    };
    expect(phonePaid('2026-11-10T10:00:00.000Z') - phonePaid('2026-11-10T08:00:00.000Z')).toBe(2000);
  });

  it('ignores accounts in another currency or left out of the plan, and needs a balance', () => {
    const plan = computePlan(megan('2026-11-10', {
      accounts: [
        { ...current('100', '2026-11-10'), id: 'gbp', name: 'UK', currency: 'GBP' },
        { ...current('9000', '2026-11-10'), id: 'savings', name: 'Savings', kind: 'savings', includeInPlan: false },
      ],
    }));
    expect(plan.balance).toBeNull();
    expect(computePlan(megan('2026-12-10', { today: '2026-11-10', accounts: [current('100', '2026-11-10')] })).balance).toBeNull();
  });
});
