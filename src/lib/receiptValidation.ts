import { recognize } from 'tesseract.js';

export interface ReceiptValidationResult {
  accepted: boolean;
  recipientMatched: boolean;
  timeMatched: boolean;
  amountMatched: boolean;
  manipulationRisk: 'low' | 'medium' | 'high';
  manipulationFlags: string[];
  ocrConfidence?: number;
  receiptHash?: string;
  imageWidth?: number;
  imageHeight?: number;
  detectedAmount?: number;
  expectedAmount?: number;
  detectedReceiptTime?: string;
  minutesDifference?: number;
  extractedText: string;
  message: string;
}

const requiredRecipient = 'muhammad firdaus';
const receiptWindowMs = 5 * 60 * 1000;
const futureGraceMs = 60 * 1000;
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

const getFileHash = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const readImageSize = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ width: 0, height: 0 });
      return;
    }

    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    image.src = url;
  });

const getOcrConfidence = (data: any) => {
  const confidence = Number(data?.confidence);
  if (Number.isFinite(confidence) && confidence > 0) return Math.round(confidence);

  const words = Array.isArray(data?.words) ? data.words : [];
  const wordConfidences = words
    .map((word: any) => Number(word?.confidence))
    .filter((value: number) => Number.isFinite(value) && value > 0);

  if (wordConfidences.length === 0) return undefined;
  return Math.round(wordConfidences.reduce((sum: number, value: number) => sum + value, 0) / wordConfidences.length);
};

const getManipulationFlags = ({
  extractedText,
  ocrConfidence,
  times,
  closest,
  now,
  amounts,
  expectedAmount,
  imageWidth,
  imageHeight,
}: {
  extractedText: string;
  ocrConfidence?: number;
  times: Date[];
  closest?: { date: Date; difference: number };
  now: Date;
  amounts: number[];
  expectedAmount: number;
  imageWidth: number;
  imageHeight: number;
}) => {
  const flags: string[] = [];
  const normalized = normalizeText(extractedText);

  if (ocrConfidence !== undefined && ocrConfidence < 55) {
    flags.push('OCR confidence is low, which can happen on edited, blurry, or cropped receipts');
  }

  if (extractedText.replace(/\s/g, '').length < 60) {
    flags.push('Receipt text is unusually short or heavily cropped');
  }

  if (imageWidth > 0 && imageHeight > 0 && (imageWidth < 500 || imageHeight < 500)) {
    flags.push('Receipt image resolution is too small for reliable checking');
  }

  if (closest && closest.date.getTime() - now.getTime() > futureGraceMs) {
    flags.push('Receipt time appears to be in the future');
  }

  const uniqueTimeBuckets = new Set(times.map((date) => Math.floor(date.getTime() / 60000)));
  if (uniqueTimeBuckets.size > 2) {
    flags.push('Multiple conflicting receipt times were detected');
  }

  const nearAmount = amounts.some((amount) => Math.abs(amount - expectedAmount) <= amountTolerance);
  const higherAmounts = amounts.filter((amount) => amount > expectedAmount + amountTolerance);
  if (nearAmount && higherAmounts.length >= 2) {
    flags.push('Several larger currency values appear near the matching amount');
  }

  if (/(edited|photoshop|canva|markup|fake|sample|template|watermark|preview)/i.test(normalized)) {
    flags.push('Possible editor/template wording detected in the image text');
  }

  return flags;
};

const getRiskLevel = (flags: string[], ocrConfidence?: number): ReceiptValidationResult['manipulationRisk'] => {
  if (flags.some((flag) => /future|conflicting|editor|template|too small/i.test(flag))) return 'high';
  if (flags.length >= 2 || (ocrConfidence !== undefined && ocrConfidence < 65)) return 'medium';
  return flags.length > 0 ? 'medium' : 'low';
};

export const validateReceiptImage = async (file: File, expectedAmount: number): Promise<ReceiptValidationResult> => {
  const [result, receiptHash, imageSize] = await Promise.all([
    recognize(file, 'eng'),
    getFileHash(file),
    readImageSize(file),
  ]);
  const extractedText = result.data.text || '';
  const normalizedText = normalizeText(extractedText);
  const recipientMatched = normalizedText.includes(requiredRecipient);
  const now = new Date();
  const times = parseReceiptTimes(extractedText, now);
  const closest = times
    .map((date) => ({ date, difference: Math.abs(now.getTime() - date.getTime()) }))
    .sort((a, b) => a.difference - b.difference)[0];

  const timeMatched = Boolean(
    closest &&
    closest.difference <= receiptWindowMs &&
    closest.date.getTime() - now.getTime() <= futureGraceMs
  );
  const amounts = parseReceiptAmounts(extractedText);
  const detectedAmount = amounts
    .sort((a, b) => Math.abs(a - expectedAmount) - Math.abs(b - expectedAmount))[0];
  const amountMatched = typeof detectedAmount === 'number' && Math.abs(detectedAmount - expectedAmount) <= amountTolerance;
  const ocrConfidence = getOcrConfidence(result.data);
  const manipulationFlags = getManipulationFlags({
    extractedText,
    ocrConfidence,
    times,
    closest,
    now,
    amounts,
    expectedAmount,
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
  });
  const manipulationRisk = getRiskLevel(manipulationFlags, ocrConfidence);
  const accepted = recipientMatched && timeMatched && amountMatched && manipulationRisk !== 'high';

  if (accepted) {
    return {
      accepted,
      recipientMatched,
      timeMatched,
      amountMatched,
      manipulationRisk,
      manipulationFlags,
      ocrConfidence,
      receiptHash,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      detectedAmount,
      expectedAmount,
      detectedReceiptTime: closest.date.toISOString(),
      minutesDifference: Math.round((closest.difference / 60000) * 10) / 10,
      extractedText,
      message: manipulationRisk === 'medium'
        ? 'Receipt accepted, but admin will see caution flags for manual review.'
        : 'Receipt accepted. Recipient, amount, and payment time look correct.',
    };
  }

  const missing = [
    recipientMatched ? '' : 'recipient must show Muhammad Firdaus',
    timeMatched ? '' : 'receipt time must be within 5 minutes',
    amountMatched ? '' : `amount must match RM ${expectedAmount.toFixed(2)}`,
    manipulationRisk === 'high' ? 'receipt has manipulation risk flags' : '',
  ].filter(Boolean);

  return {
    accepted,
    recipientMatched,
    timeMatched,
    amountMatched,
    manipulationRisk,
    manipulationFlags,
    ocrConfidence,
    receiptHash,
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    detectedAmount,
    expectedAmount,
    detectedReceiptTime: closest?.date.toISOString(),
    minutesDifference: closest ? Math.round((closest.difference / 60000) * 10) / 10 : undefined,
    extractedText,
    message: `Receipt rejected: ${missing.join(' and ')}.`,
  };
};
