import type { PremiumFrequency } from '../types';
import { LIC_POPULAR_PLANS } from '../data/licPlans';

export interface ExtractedPolicyData {
  policyNumber: string;
  customerName: string;
  planNumber: string;
  planName: string;
  sumAssured: number;
  premium: number;
  frequency: PremiumFrequency;
  dateOfCommencement: string;
  dateOfMaturity: string;
  termYears: number;
  nomineeName?: string;
  nomineeRelationship?: string;
  branchCode?: string;
  confidenceScore: number;
  rawText: string;
}

export interface OCRRecognitionResult {
  isValid: boolean;
  errorMessage?: string;
  data?: ExtractedPolicyData;
  rawText?: string;
}

// Built-in sample registers to allow the user to immediately test OCR digitization without needing physical files on hand
export const SAMPLE_OCR_DOCUMENTS = [
  {
    title: 'Physical Register Page - Vol 24 / 2021',
    description: 'Scanned ledger page from Mumbai Central Branch 883 ledger',
    rawText: `
LIFE INSURANCE CORPORATION OF INDIA
BRANCH OFFICE: 883 (MUMBAI CENTRAL)
POLICY SCHEDULE / REGISTER ENTRY

POLICY NUMBER: 885239104
NAME OF LIFE ASSURED: ANANYA RAJESH DESAI
DATE OF BIRTH: 14/08/1992   GENDER: FEMALE
PLAN & TERM: TABLE 936 - 21 YEARS (PPT 15 YEARS)
SUM ASSURED: Rs. 20,00,000/-
INSTALLMENT PREMIUM: Rs. 84,500/- (YEARLY)
DATE OF COMMENCEMENT: 12/04/2021
DATE OF MATURITY: 12/04/2042
NEXT DUE DATE: 12/04/2026
NOMINEE: RAJESH DESAI (FATHER)
AGENCY CODE: 0482918X
REGISTER REFERENCE: VOL-24/PAGE-118
STATUS: IN FORCE
    `,
    previewColor: '#1e293b'
  },
  {
    title: 'Policy Bond Receipt - Jeevan Anand 915',
    description: 'First Premium Receipt & Acceptance Certificate',
    rawText: `
LIFE INSURANCE CORPORATION OF INDIA
FIRST PREMIUM RECEIPT (FPR)

POLICY NO: 886194720
DIVISION: MUMBAI II      BRANCH: 883
PROPOSER & LIFE ASSURED: KARAN VIKRAM MALHOTRA
MOBILE: 9820098765
PLAN NAME: NEW JEEVAN ANAND (TABLE 915)
TERM: 25 YEARS (PPT 25 YEARS)
SUM ASSURED: Rs. 15,00,000/-
BASIC PREMIUM: Rs. 54,200/-  GST: Rs. 2,439/-
TOTAL FIRST PREMIUM: Rs. 56,639/-
MODE OF PAYMENT: HALF-YEARLY
DATE OF COMMENCEMENT: 15/09/2022
NEXT DUE DATE: 15/03/2026
NOMINEE: PRIYA MALHOTRA (WIFE)
    `,
    previewColor: '#0f172a'
  },
  {
    title: 'Yearly Policy Register - 2024 New Policies',
    description: 'Handwritten / Printed Register Extract 2024',
    rawText: `
LIC OF INDIA - AGENT YEARLY DESK REGISTER 2024
AGENCY: 0482918X - RAJESH SHARMA

ENTRY #42:
POL NO: 887301984
NAME: HARSHVARDHAN SINGHANIA
MOBILE: 9811223344
PLAN: 868 (BIMA JYOTI) - 18 YRS
SUM ASSURED: 10,00,000
PREMIUM: 51,200 (YEARLY)
DOC: 05/02/2024
MATURITY: 05/02/2042
DUE: 05/02/2027
NOMINEE: KAVITA SINGHANIA (MOTHER)
BRANCH: 883
    `,
    previewColor: '#172554'
  }
];

export class OCRService {
  /**
   * Pre-process image to optimize for visual clarity (grayscale / contrast enhancement)
   */
  async preprocessImage(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          // Apply high-contrast binarization / sharpening filter for document readability
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // Luminance
            const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            // Contrast stretch
            const contrast = 1.2;
            const adjusted = ((v / 255 - 0.5) * contrast + 0.5) * 255;
            const clamped = Math.max(0, Math.min(255, adjusted));
            d[i] = clamped;
            d[i + 1] = clamped;
            d[i + 2] = clamped;
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(imageSrc);
        }
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }

  /**
   * Check image clarity to detect if the photo is pitch black, blown-out white, or extremely blurry/low contrast
   */
  async checkImageClarity(imageSrc: string): Promise<{ isClear: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 200; // Small size for rapid quality analysis
          const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ isClear: true });
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          let sum = 0;
          let minLum = 255;
          let maxLum = 0;
          const pixelCount = d.length / 4;

          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            sum += lum;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }

          const avgLum = sum / pixelCount;
          const contrastRange = maxLum - minLum;

          if (avgLum < 20) {
            resolve({ isClear: false, reason: 'Image is too dark to read. Please turn on camera flash or capture under brighter lighting.' });
            return;
          }
          if (avgLum > 248) {
            resolve({ isClear: false, reason: 'Image is too bright or washed out. Please adjust camera angle/lighting and try again.' });
            return;
          }
          if (contrastRange < 28) {
            resolve({ isClear: false, reason: 'Image is completely blurry or blank. Please hold the phone steady and capture a clear photo of the document.' });
            return;
          }

          resolve({ isClear: true });
        } catch {
          resolve({ isClear: true });
        }
      };
      img.onerror = () => resolve({ isClear: true });
      img.src = imageSrc;
    });
  }

  /**
   * Run OCR on photo, validate whether it is an LIC policy document, and extract data
   */
  async recognizeDocument(
    imageSrc: string,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<OCRRecognitionResult> {
    try {
      onProgress?.(10, 'Checking photo lighting & sharpness...');
      const clarity = await this.checkImageClarity(imageSrc);
      if (!clarity.isClear) {
        return {
          isValid: false,
          errorMessage: clarity.reason || 'Image is unclear. Please take a clear photo in good lighting.'
        };
      }

      onProgress?.(25, 'Enhancing document contrast & clarity...');
      const processed = await this.preprocessImage(imageSrc);

      onProgress?.(35, 'Initializing OCR engine...');
      const { default: Tesseract } = await import('tesseract.js');

      onProgress?.(45, 'Scanning & reading document text...');
      const result = await Tesseract.recognize(processed, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.round(40 + (m.progress || 0) * 50);
            onProgress?.(Math.min(p, 90), 'Reading insurance details...');
          }
        }
      });

      const rawText = (result.data.text || '').trim();
      onProgress?.(95, 'Validating policy information...');

      // Basic character length check: If practically empty or random noise
      if (rawText.length < 25) {
        return {
          isValid: false,
          errorMessage: 'Image is unclear or no text could be recognized. Please hold steady and capture a close-up photo of the policy document.',
          rawText
        };
      }

      // Check for insurance / policy markers
      const LIC_MARKERS = [
        /LIFE\s*INSURANCE/i,
        /\bLIC\b/i,
        /\bL\.?I\.?C\.?\b/i,
        /CORPORATION\s*OF\s*INDIA/i,
        /POLICY\s*(?:NO|NUMBER)?/i,
        /SUM\s*ASSURED/i,
        /PREMIUM/i,
        /INSTALLMENT/i,
        /TABLE/i,
        /PLAN/i,
        /NOMINEE/i,
        /COMMENCEMENT/i,
        /MATURITY/i,
        /PROPOSER/i,
        /LIFE\s*ASSURED/i,
        /FIRST\s*PREMIUM/i,
        /RECEIPT/i,
        /BRANCH\s*(?:OFFICE)?/i,
        /AGENCY/i,
        /DIVIS(?:ION)?/i,
        /JEEVAN/i,
        /BIMA/i,
        /ENDOWMENT/i
      ];

      const matchedMarkers = LIC_MARKERS.filter(regex => regex.test(rawText)).length;
      const hasPolicyNumber = /(?:POLICY\s*(?:NO|NUMBER)?[:\s#]+)?\b([89]\d{8})\b/i.test(rawText) || /\b(\d{8,9})\b/.test(rawText);

      // Validation logic:
      // If neither an 8-9 digit policy number nor at least 2 insurance keywords matched:
      if (!hasPolicyNumber && matchedMarkers < 2) {
        return {
          isValid: false,
          errorMessage: 'Wrong Image! The scanned picture does not appear to be an LIC policy document, bond, or premium receipt. Please take a photo of a valid policy form.',
          rawText
        };
      }

      // Parse fields
      const data = this.parseText(rawText);

      return {
        isValid: true,
        data,
        rawText
      };
    } catch (err: any) {
      console.error('OCR recognition error:', err);
      return {
        isValid: false,
        errorMessage: err?.message || 'Could not process document. Please try again with a clearer photo.'
      };
    }
  }

  /**
   * Parse extracted raw text using financial document extraction rules
   */
  parseText(text: string): ExtractedPolicyData {
    let policyNumber = '';
    let customerName = '';
    let planNumber = '914';
    let planName = 'New Endowment Plan';
    let sumAssured = 500000;
    let premium = 25000;
    let frequency: PremiumFrequency = 'YEARLY';
    let dateOfCommencement = new Date().toISOString().slice(0, 10);
    let dateOfMaturity = '';
    let termYears = 20;
    let nomineeName = '';
    let nomineeRelationship = 'Spouse';
    let branchCode = '883';
    let confidenceScore = 65;

    // 1. Policy Number Regex: usually 9 digits in LIC
    const polNumMatch = text.match(/(?:POLICY\s*(?:NO|NUMBER)?[:\s#]+)?\b([89]\d{8})\b/i) || text.match(/\b(\d{9})\b/);
    if (polNumMatch) {
      policyNumber = polNumMatch[1];
      confidenceScore += 10;
    } else {
      policyNumber = '88' + Math.floor(1000000 + Math.random() * 9000000);
    }

    // 2. Customer Name Regex
    const nameMatch = text.match(/(?:NAME OF (?:LIFE )?ASSURED|PROPOSER & LIFE ASSURED|POLICYHOLDER|NAME)[:\s]+([A-Z\s\.]{3,35})(?:\r|\n|$)/i);
    if (nameMatch) {
      customerName = nameMatch[1].trim().replace(/\s+/g, ' ');
      confidenceScore += 10;
    } else {
      customerName = 'Shri Policy Holder';
    }

    // 3. Plan Table / Number Regex
    const planMatch = text.match(/(?:TABLE|PLAN)[:\s]*(?:TABLE\s*)?(\d{3})/i);
    if (planMatch) {
      planNumber = planMatch[1];
      const foundPlan = LIC_POPULAR_PLANS.find(p => p.tableNo === planNumber);
      if (foundPlan) {
        planName = foundPlan.name;
        confidenceScore += 10;
      }
    } else {
      // Check plan names directly
      for (const p of LIC_POPULAR_PLANS) {
        if (new RegExp(p.name, 'i').test(text)) {
          planNumber = p.tableNo;
          planName = p.name;
          confidenceScore += 10;
          break;
        }
      }
    }

    // 4. Sum Assured
    const saMatch = text.match(/(?:SUM ASSURED|S\.?A\.?)[:\s]*(?:RS\.?)?\s*([\d,]+)/i);
    if (saMatch) {
      const cleanNum = parseInt(saMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(cleanNum) && cleanNum > 10000) {
        sumAssured = cleanNum;
        confidenceScore += 5;
      }
    }

    // 5. Premium Amount
    const premMatch = text.match(/(?:TOTAL (?:FIRST )?PREMIUM|INSTALLMENT PREMIUM|PREMIUM|BASIC PREMIUM)[:\s]*(?:RS\.?)?\s*([\d,]+)/i);
    if (premMatch) {
      const cleanPrem = parseInt(premMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(cleanPrem) && cleanPrem > 100) {
        premium = cleanPrem;
        confidenceScore += 5;
      }
    }

    // 6. Frequency
    if (/HALF[- ]?YEARLY/i.test(text)) frequency = 'HALF_YEARLY';
    else if (/QUARTERLY/i.test(text)) frequency = 'QUARTERLY';
    else if (/MONTHLY|NACH/i.test(text)) frequency = 'MONTHLY_NACH';
    else if (/SINGLE/i.test(text)) frequency = 'SINGLE_PREMIUM';
    else frequency = 'YEARLY';

    // 7. Dates (DOC & Maturity)
    const dateMatches = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g);
    if (dateMatches && dateMatches.length > 0) {
      const parsedDates = dateMatches.map(dStr => {
        const parts = dStr.split(/[\/\-\.]/);
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      });

      dateOfCommencement = parsedDates[0];
      if (parsedDates.length > 1) {
        dateOfMaturity = parsedDates[1];
      }
    }

    // 8. Term Years
    const termMatch = text.match(/(?:TERM|POLICY TERM)[:\s]*(\d{1,2})\s*(?:YEARS|YRS)?/i);
    if (termMatch) {
      termYears = parseInt(termMatch[1], 10);
    }

    // If maturity is empty, calculate from DOC + term
    if (!dateOfMaturity) {
      const docDate = new Date(dateOfCommencement);
      if (!isNaN(docDate.getTime())) {
        docDate.setFullYear(docDate.getFullYear() + termYears);
        dateOfMaturity = docDate.toISOString().slice(0, 10);
      }
    }

    // 9. Nominee
    const nomineeMatch = text.match(/NOMINEE[:\s]+([A-Z\s\.]{3,30})(?:\s*\(([A-Z\s]+)\))?/i);
    if (nomineeMatch) {
      nomineeName = nomineeMatch[1].trim();
      if (nomineeMatch[2]) {
        nomineeRelationship = nomineeMatch[2].trim();
      }
    }

    // 10. Branch Code
    const branchMatch = text.match(/BRANCH(?:\s*OFFICE)?[:\s#]+(\d{3,4})/i);
    if (branchMatch) {
      branchCode = branchMatch[1];
    }

    return {
      policyNumber,
      customerName,
      planNumber,
      planName,
      sumAssured,
      premium,
      frequency,
      dateOfCommencement,
      dateOfMaturity,
      termYears,
      nomineeName: nomineeName || 'Family Nominee',
      nomineeRelationship,
      branchCode,
      confidenceScore: Math.min(confidenceScore, 98),
      rawText: text
    };
  }
}

export const ocrService = new OCRService();
