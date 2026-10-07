import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Policy, Customer, AuditLog, AppSettings } from '../types';

export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function downloadCSV(filename: string, csvContent: string): void {
  // Prepend UTF-8 BOM so Microsoft Excel correctly parses UTF-8 encoding
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPoliciesToCSV(policies: Policy[], filenamePrefix: string = 'LIC_Policies'): void {
  const headers = [
    'Policy Number',
    'Customer Name',
    'Mobile',
    'Plan No & Name',
    'Sum Assured (INR)',
    'Premium (INR)',
    'Frequency',
    'Term (Yrs)',
    'PPT (Yrs)',
    'Date of Commencement',
    'Next Due Date',
    'Date of Maturity',
    'Status',
    'Nominee Name',
    'Relationship',
    'Branch Code',
    'Agency Code',
    'Notes'
  ];

  const rows = policies.map((p) => [
    `"${p.policyNumber}"`,
    `"${(p.customerName || '').replace(/"/g, '""')}"`,
    `"${p.customerMobile || ''}"`,
    `"${p.planNumber} - ${(p.planName || '').replace(/"/g, '""')}"`,
    p.sumAssured,
    p.totalPremium,
    `"${p.frequency}"`,
    p.policyTermYears,
    p.premiumPayingTermYears,
    p.dateOfCommencement,
    p.nextDueDate,
    p.dateOfMaturity,
    `"${p.status}"`,
    `"${(p.nomineeName || '').replace(/"/g, '""')}"`,
    `"${p.nomineeRelationship || ''}"`,
    `"${p.branchCode || ''}"`,
    `"${p.agencyCode || ''}"`,
    `"${(p.notes || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csv);
}

export function exportCustomersToCSV(customers: Customer[]): void {
  const headers = [
    'Customer ID',
    'Full Name',
    'Mobile',
    'Email',
    'Date of Birth',
    'Gender',
    'City',
    'State',
    'Pincode',
    'PAN Number',
    'Aadhaar (Last 4)',
    'Occupation',
    'Emergency Contact',
    'Notes'
  ];

  const rows = customers.map(c => [
    `"${c.id}"`,
    `"${(c.fullName || '').replace(/"/g, '""')}"`,
    `"${c.mobile}"`,
    `"${c.email || ''}"`,
    c.dateOfBirth,
    `"${c.gender}"`,
    `"${c.city || ''}"`,
    `"${c.state || ''}"`,
    `"${c.pincode || ''}"`,
    `"${c.panNumber || ''}"`,
    `"${c.aadhaarLast4 || ''}"`,
    `"${(c.occupation || '').replace(/"/g, '""')}"`,
    `"${(c.emergencyContact || '').replace(/"/g, '""')}"`,
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `LIC_Policyholders_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csv);
}

export function exportAuditLogsToCSV(logs: AuditLog[]): void {
  const headers = [
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'User Name',
    'User Role',
    'Summary'
  ];

  const rows = logs.map(l => [
    `"${l.timestamp}"`,
    `"${l.action}"`,
    `"${l.entityType}"`,
    `"${l.entityId || ''}"`,
    `"${l.userName}"`,
    `"${l.userRole}"`,
    `"${(l.entitySummary || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `LIC_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csv);
}

export function downloadJSONFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function generatePolicySchedulePDF(policy: Policy, settings: AppSettings): Promise<boolean> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const formatPdfINR = (val: number | undefined | null) => {
    return 'Rs. ' + (Number(val || 0)).toLocaleString('en-IN');
  };

  const formatPdfFreq = (freq: string) => {
    switch (freq) {
      case 'YEARLY': return 'Yearly';
      case 'HALF_YEARLY': return 'Half-Yearly';
      case 'QUARTERLY': return 'Quarterly';
      case 'MONTHLY_NACH': return 'Monthly (NACH)';
      case 'SINGLE_PREMIUM': return 'Single Premium';
      default: return (freq || '').replace('_', ' ');
    }
  };

  // Outer Border (Navy)
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, 190, 277);

  // Inner Border (Gold)
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, 186, 273);

  // Header Banner
  doc.setFillColor(30, 58, 138);
  doc.rect(13, 13, 184, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL POLICY SCHEDULE & STATUS CERTIFICATE', 105, 18.5, { align: 'center' });

  // Organization Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text('LIFE INSURANCE CORPORATION OF INDIA', 105, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const branchText = `Branch: ${policy.branchCode || settings.branchCode || '708'}  |  Agency: ${policy.agencyCode || settings.agentCode || '0708139A'}  |  Advisor: ${settings.agentName || 'Senior Advisory Consultant'}`;
  doc.text(branchText, 105, 36, { align: 'center' });

  // Decorative Rule
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.line(20, 40, 190, 40);

  // Policy Particulars Header
  doc.setFillColor(241, 245, 249);
  doc.rect(20, 44, 170, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('POLICY SCHEDULE PARTICULARS', 25, 48.5);

  const particulars: Array<{ label: string; value: string; isBold?: boolean; color?: [number, number, number] }> = [
    { label: 'Policy Number', value: policy.policyNumber, isBold: true, color: [30, 58, 138] },
    { label: 'Name of Life Assured', value: policy.customerName || 'N/A', isBold: true, color: [15, 23, 42] },
    { label: 'Plan & Table Number', value: `Table ${policy.planNumber} - ${policy.planName}` },
    { label: 'Sum Assured', value: formatPdfINR(policy.sumAssured), isBold: true, color: [4, 120, 87] },
    { label: 'Installment Premium', value: `${formatPdfINR(policy.totalPremium)} (${formatPdfFreq(policy.frequency)})`, isBold: true },
    { label: 'Policy Term / PPT', value: `Term: ${policy.policyTermYears || 0} Yrs  |  PPT: ${policy.premiumPayingTermYears || 0} Yrs` },
    { label: 'Date of Commencement (DOC)', value: formatDate(policy.dateOfCommencement) },
    { label: 'Date of Maturity', value: formatDate(policy.dateOfMaturity) },
    { label: 'Next Due Date', value: formatDate(policy.nextDueDate), isBold: true, color: [180, 83, 9] },
    { label: 'Nominee Name & Relationship', value: `${policy.nomineeName || 'As per record'} (${policy.nomineeRelationship || 'Spouse'})` },
    { label: 'Branch Code', value: String(policy.branchCode || settings.branchCode || '708') },
    { label: 'Agency Code', value: String(policy.agencyCode || settings.agentCode || '0708139A') },
    { label: 'Current Policy Status', value: policy.status, isBold: true, color: policy.status === 'IN_FORCE' ? [4, 120, 87] : [190, 18, 60] }
  ];

  const startY = 53;
  const rowHeight = 11;

  particulars.forEach((row, i) => {
    const y = startY + (i * rowHeight);

    // Alternate background
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y, 170, rowHeight, 'F');
    }

    // Row border line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(20, y + rowHeight, 190, y + rowHeight);

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(row.label, 25, y + 7.5);

    // Colon
    doc.text(':', 85, y + 7.5);

    // Value
    doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    if (row.color) {
      doc.setTextColor(row.color[0], row.color[1], row.color[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(row.value, 90, y + 7.5);
  });

  // Footer section
  const footerY = 205;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(20, footerY, 190, footerY);

  // Left Note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('Official Policy Schedule Certificate', 25, footerY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${formatDate(new Date().toISOString())}`, 25, footerY + 13);
  doc.text('Authorized agency schedule record for insurance advisory.', 25, footerY + 18);

  // Right Signatory
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(130, footerY + 16, 185, footerY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.agentName || 'Life Insurance Advisor', 157.5, footerY + 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Agent / Consultant', 157.5, footerY + 25, { align: 'center' });

  // Save PDF to phone
  const cleanNum = policy.policyNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `LIC_Policy_Schedule_${cleanNum}.pdf`;

  // 1. Native Capacitor on Mobile (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: `LIC Policy Certificate - ${policy.policyNumber}`,
        text: `Official Policy Schedule for ${policy.customerName || 'Life Assured'} (Policy #${policy.policyNumber})`,
        url: savedFile.uri,
        dialogTitle: 'Save Policy PDF'
      });
      return true;
    } catch (nativeErr) {
      console.warn('Native Capacitor share failed, falling back:', nativeErr);
    }
  }

  // 2. Web Share API fallback (works in mobile browsers / webviews with file share support)
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `LIC Policy #${policy.policyNumber}`,
          text: `Policy Schedule Certificate for ${policy.customerName || 'Life Assured'}`
        });
        return true;
      }
    } catch (shareErr) {
      console.warn('Web Share API cancelled or not supported:', shareErr);
    }
  }

  // 3. Desktop / Browser direct download fallback
  try {
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('Failed to trigger browser download:', err);
    return false;
  }
}
