import { recognize } from 'tesseract.js';

export interface ReceiptValidationResult {
  accepted: boolean;
  recipientMatched: boolean;
  timeMatched: boolean;
  amountMatched: boolean;
  detectedAmount?: number;
  expectedAmount?: number;
  detectedReceiptTime?: string;
  minutesDifference?: number;
  extractedText: string;
  message: string;
}

const requiredRecipient = 'muhammad firdaus';
const receiptWindowMs = 5 * 60 * 1000;
const amountTolerance = 0.01;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseReceiptTimes = (text: string, now = new Date()) => {
  const candidates: Date[] = [];
  const dates: Array<{ day: number; month: number; year: number }> = [];

  const numericDate = new RegExp(String.raw`\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b`, 'g');
  for (const match of text.matchAll(numericDate)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      dates.push({ day, month, year });
    }
  }

  const isoDate = new RegExp(String.raw`\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b`, 'g');
  for (const match of text.matchAll(isoDate)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      dates.push({ day, month, year });
    }
  }

  if (dates.length === 0) {
    dates.push({
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
  }

  const times = /\b([01]?\d|2[0-3])[:. ]([0-5]\d)(?:[:. ]([0-5]\d))?\s*(am|pm)?\b/gi;
  for (const match of text.matchAll(times)) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] ? Number(match[3]) : 0;
    const meridiem = match[4]?.toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    for (const date of dates) {
      candidates.push(new Date(date.year, date.month - 1, date.day, hour, minute, second));
    }
  }

  return candidates.filter((date) => !Number.isNaN(date.getTime()));
};

const parseReceiptAmounts = (text: string) => {
  const amounts: number[] = [];
  const strictCurrency = /\b(?:rm|myr)\s*([0-9]{1,6}(?:[,.][0-9]{2})?)\b/gi;
  const looseCurrency = /\b([0-9]{1,6}[,.][0-9]{2})\b/g;

  for (const match of text.matchAll(strictCurrency)) {
    amounts.push(Number(match[1].replace(',', '.')));
  }

  if (amounts.length === 0) {
    for (const match of text.matchAll(looseCurrency)) {
      amounts.push(Number(match[1].replace(',', '.')));
    }
  }

  return amounts.filter((amount) => Number.isFinite(amount) && amount > 0);
};

export const validateReceiptImage = async (file: File, expectedAmount: number): Promise<ReceiptValidationResult> => {
  const result = await recognize(file, 'eng');
  const extractedText = result.data.text || '';
  const normalizedText = normalizeText(extractedText);
  const recipientMatched = normalizedText.includes(requiredRecipient);
  const now = new Date();
  const times = parseReceiptTimes(extractedText, now);
  const closest = times
    .map((date) => ({ date, difference: Math.abs(now.getTime() - date.getTime()) }))
    .sort((a, b) => a.difference - b.difference)[0];

  const timeMatched = Boolean(closest && closest.difference <= receiptWindowMs);
  const detectedAmount = parseReceiptAmounts(extractedText)
    .sort((a, b) => Math.abs(a - expectedAmount) - Math.abs(b - expectedAmount))[0];
  const amountMatched = typeof detectedAmount === 'number' && Math.abs(detectedAmount - expectedAmount) <= amountTolerance;
  const accepted = recipientMatched && timeMatched && amountMatched;

  if (accepted) {
    return {
      accepted,
      recipientMatched,
      timeMatched,
      amountMatched,
      detectedAmount,
      expectedAmount,
      detectedReceiptTime: closest.date.toISOString(),
      minutesDifference: Math.round((closest.difference / 60000) * 10) / 10,
      extractedText,
      message: 'Receipt accepted. Recipient and payment time look correct.',
    };
  }

  const missing = [
    recipientMatched ? '' : 'recipient must show Muhammad Firdaus',
    timeMatched ? '' : 'receipt time must be within 5 minutes',
    amountMatched ? '' : `amount must match RM ${expectedAmount.toFixed(2)}`,
  ].filter(Boolean);

  return {
    accepted,
    recipientMatched,
    timeMatched,
    amountMatched,
    detectedAmount,
    expectedAmount,
    detectedReceiptTime: closest?.date.toISOString(),
    minutesDifference: closest ? Math.round((closest.difference / 60000) * 10) / 10 : undefined,
    extractedText,
    message: `Receipt rejected: ${missing.join(' and ')}.`,
  };
};
