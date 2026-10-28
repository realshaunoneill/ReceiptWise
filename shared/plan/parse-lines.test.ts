import { describe, expect, it } from 'vitest';
import { parseLines, quickAddLine } from './parse-lines';

describe('parseLines', () => {
  it('reads "label amount" lines', () => {
    expect(parseLines('Rent 150\nNiamhs wedding 400\nPetrol and rolls 115')).toEqual([
      { label: 'Rent', amount: '150' },
      { label: 'Niamhs wedding', amount: '400' },
      { label: 'Petrol and rolls', amount: '115' },
    ]);
  });

  it('reads a column copied from a spreadsheet, blanks included', () => {
    expect(parseLines('Rent\t150\nPost office\t\nCar\t469\t\t\nSavings\t1,500')).toEqual([
      { label: 'Rent', amount: '150' },
      { label: 'Post office', amount: null },
      { label: 'Car', amount: '469' },
      { label: 'Savings', amount: '1500' },
    ]);
  });

  it('handles currency signs, colons and decimal commas', () => {
    expect(parseLines('Car: €469.00\nDress = 85,50\nPhone 20 euro\nGym £30')).toEqual([
      { label: 'Car', amount: '469.00' },
      { label: 'Dress', amount: '85.50' },
      { label: 'Phone', amount: '20' },
      { label: 'Gym', amount: '30' },
    ]);
  });

  it('keeps a label ending in a number when the spreadsheet cell beside it is empty', () => {
    expect(parseLines('Until Aug 25\t\nRent first half of Nov\t70')).toEqual([
      { label: 'Until Aug 25', amount: null },
      { label: 'Rent first half of Nov', amount: '70' },
    ]);
  });

  it('reads a trailing number as the amount in typed text (the review step shows it)', () => {
    expect(parseLines('Rent first half of Nov 70')).toEqual([{ label: 'Rent first half of Nov', amount: '70' }]);
  });

  it('calls a line that is only an amount "Extra", typed or copied from a spreadsheet', () => {
    expect(parseLines('85\n€1,200.50\nDress 40')).toEqual([
      { label: 'Extra', amount: '85' },
      { label: 'Extra', amount: '1200.50' },
      { label: 'Dress', amount: '40' },
    ]);
    expect(parseLines('\t60\nRent\t150')).toEqual([
      { label: 'Extra', amount: '60' },
      { label: 'Rent', amount: '150' },
    ]);
  });

  it('skips empty lines and keeps amount-less labels', () => {
    expect(parseLines('\n  \nNCT\n')).toEqual([{ label: 'NCT', amount: null }]);
  });
});

describe('quickAddLine', () => {
  it('takes a label and an amount as typed', () => {
    expect(quickAddLine(' Dress ', '85.50')).toEqual({ label: 'Dress', cents: 8550, named: true });
    expect(quickAddLine('Car', '1,450')).toEqual({ label: 'Car', cents: 145000, named: true });
  });

  it('calls a line with no label "Extra", and reads an amount typed into the label box', () => {
    expect(quickAddLine('', '60')).toEqual({ label: 'Extra', cents: 6000, named: false });
    expect(quickAddLine('€85', '')).toEqual({ label: 'Extra', cents: 8500, named: false });
  });

  it('has no amount when none was typed', () => {
    expect(quickAddLine('Birthday present', '')).toEqual({ label: 'Birthday present', cents: null, named: true });
    expect(quickAddLine('Dress', 'lots').cents).toBeNull();
  });
});
