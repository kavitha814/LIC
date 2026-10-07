import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight
} from 'lucide-react';
import type { Policy, Customer, AppSettings, PremiumFrequency } from '../types';
import { ocrService, type ExtractedPolicyData } from '../services/ocr';
import { formatINR, formatDate } from '../services/export';

interface SmartCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  policies: Policy[];
  customers: Customer[];
  settings: AppSettings;
  onSavePolicy: (policy: Policy) => Promise<void>;
  onSaveCustomer: (customer: Customer) => Promise<Customer>;
  onPolicyAdded: (policy: Policy) => void;
}

type ScanStatus = 'idle' | 'scanning' | 'wrong_image' | 'success';

export const SmartCameraScanner: React.FC<SmartCameraScannerProps> = ({
  isOpen,
  onClose,
  policies,
  customers,
  settings,
  onSavePolicy,
  onSaveCustomer,
  onPolicyAdded
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [addedPolicy, setAddedPolicy] = useState<Policy | null>(null);

  // Automatically trigger camera when opened
  useEffect(() => {
    if (isOpen && status === 'idle' && !imagePreview) {
      // Small timeout to allow modal mount
      const t = setTimeout(() => {
        triggerCamera();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const calculateNextDueDate = (doc: string, freq: PremiumFrequency | string): string => {
    if (!doc) return '';
    const d = new Date(doc);
    if (isNaN(d.getTime())) return '';
    switch (freq) {
      case 'YEARLY':
        d.setFullYear(d.getFullYear() + 1);
        break;
      case 'HALF_YEARLY':
        d.setMonth(d.getMonth() + 6);
        break;
      case 'QUARTERLY':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'MONTHLY_NACH':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'SINGLE_PREMIUM':
        return doc;
      default:
        d.setFullYear(d.getFullYear() + 1);
    }
    return d.toISOString().slice(0, 10);
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // If user cancelled camera without taking photo and nothing was scanned yet
      if (status === 'idle') {
        onClose();
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setStatus('scanning');
      setProgressPercent(10);
      setProgressStage('Checking photo quality & lighting...');

      try {
        const result = await ocrService.recognizeDocument(base64, (percent, stage) => {
          setProgressPercent(percent);
          setProgressStage(stage);
        });

        if (!result.isValid || !result.data) {
          setStatus('wrong_image');
          setErrorMessage(result.errorMessage || 'Wrong Image: Not a recognized LIC policy document.');
          return;
        }

        // Successfully validated as a real LIC policy document!
        setProgressStage('Finalizing & adding policy to database...');
        setProgressPercent(100);

        const data: ExtractedPolicyData = result.data;

        // 1. Resolve or Create Customer
        let targetCustomer = customers.find(c => 
          c.fullName.toLowerCase().trim() === data.customerName.toLowerCase().trim()
        );

        if (!targetCustomer) {
          const generatedMobile = '98' + Math.floor(10000000 + Math.random() * 90000000);
          targetCustomer = await onSaveCustomer({
            id: '',
            fullName: data.customerName || 'Life Assured',
            mobile: generatedMobile,
            city: settings.divisionName || 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            dateOfBirth: '1990-01-01',
            gender: 'MALE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        // 2. Compute Sheet & Serial Number
        const currentYear = new Date(data.dateOfCommencement).getFullYear() || 2024;
        const fy = `${currentYear}-${currentYear + 1}`;
        const sheetPolicies = policies.filter(p => (p.sheetName || p.financialYear) === fy);
        const maxSerial = sheetPolicies.reduce((max, p) => Math.max(max, p.ledgerSerialNo || 0), 0);
        const nextSerial = maxSerial > 0 ? maxSerial + 1 : sheetPolicies.length + 1;

        const nextDue = calculateNextDueDate(data.dateOfCommencement, data.frequency);

        // 3. Create Policy
        const newPolicy: Policy = {
          id: `pol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          policyNumber: data.policyNumber,
          customerId: targetCustomer.id,
          customerName: targetCustomer.fullName,
          customerMobile: targetCustomer.mobile,
          planNumber: data.planNumber,
          planName: data.planName,
          sumAssured: data.sumAssured,
          basicPremium: data.premium,
          gstAmount: Math.round(data.premium * 0.045),
          totalPremium: data.premium,
          frequency: data.frequency,
          policyTermYears: data.termYears,
          premiumPayingTermYears: data.termYears,
          dateOfCommencement: data.dateOfCommencement,
          dateOfMaturity: data.dateOfMaturity,
          nextDueDate: nextDue,
          status: 'IN_FORCE',
          nomineeName: data.nomineeName || 'Family Nominee',
          nomineeRelationship: data.nomineeRelationship || 'Spouse',
          branchCode: data.branchCode || settings.branchCode || '883',
          agencyCode: settings.agentCode || '0482918X',
          commencementYear: currentYear,
          financialYear: fy,
          sheetName: fy,
          ledgerSerialNo: nextSerial,
          notes: `Added automatically via Smart Camera Scan on ${new Date().toLocaleDateString()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 4. Save directly into offline database
        await onSavePolicy(newPolicy);
        setAddedPolicy(newPolicy);
        setStatus('success');
      } catch (err: any) {
        console.error('Scan processing failure:', err);
        setStatus('wrong_image');
        setErrorMessage(err?.message || 'Failed to process document image. Please retake photo.');
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setImagePreview(null);
    setStatus('idle');
    setErrorMessage('');
    triggerCamera();
  };

  const handleViewPolicy = () => {
    if (addedPolicy) {
      onPolicyAdded(addedPolicy);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      {/* Hidden Native File & Camera Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleImageCapture}
      />

      <div 
        className="lic-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: 0
        }}
      >
        {/* Modal Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Camera size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
              Smart Policy Camera Scan
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* STATE 1: SCANNING / PROCESSING */}
          {status === 'scanning' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              {imagePreview && (
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '210px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid #3b82f6',
                  background: '#0f172a'
                }}>
                  <img 
                    src={imagePreview} 
                    alt="Captured Policy" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
                  />
                  {/* Glowing Laser Scan Bar */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, transparent, #38bdf8, #60a5fa, #38bdf8, transparent)',
                    boxShadow: '0 0 12px #38bdf8, 0 0 20px #60a5fa',
                    animation: 'scannerLaser 2s infinite ease-in-out'
                  }} />
                </div>
              )}

              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>{progressStage}</span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{progressPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
                Please keep the app open while we read and verify the policy details...
              </p>
            </div>
          )}

          {/* STATE 2: WRONG IMAGE / UNCLEAR */}
          {status === 'wrong_image' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
              }}>
                <AlertTriangle size={34} strokeWidth={2.2} />
              </div>

              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', margin: '0 0 6px 0' }}>
                  Wrong Image!
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.45', margin: 0 }}>
                  {errorMessage}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '12px',
                color: 'var(--text-dim)',
                textAlign: 'left',
                width: '100%'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Tips for successful scanning:
                </div>
                • Capture an official <strong>LIC Policy Bond</strong>, <strong>First Premium Receipt (FPR)</strong>, or <strong>Ledger Register</strong>.<br />
                • Ensure the 9-digit policy number and plan details are clearly visible.<br />
                • Hold the phone steady and avoid heavy glare or dark shadows.
              </div>

              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={handleRetake}
                  style={{ flex: 2, padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <RefreshCw size={15} />
                  <span>Retake Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: SUCCESS (AUTO-ADDED) */}
          {status === 'success' && addedPolicy && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
              }}>
                <CheckCircle2 size={36} strokeWidth={2.4} />
              </div>

              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#059669', margin: '0 0 4px 0' }}>
                  Policy Added Automatically!
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Details were extracted from your image and committed directly into the database.
                </p>
              </div>

              {/* Summary Card */}
              <div style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>POLICY NUMBER</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#2563eb' }}>{addedPolicy.policyNumber}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>LIFE ASSURED</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{addedPolicy.customerName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>PLAN / TABLE</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {addedPolicy.planName} ({addedPolicy.planNumber})
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>SUM ASSURED</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#d97706' }}>{formatINR(addedPolicy.sumAssured)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>PREMIUM ({addedPolicy.frequency})</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#d97706' }}>{formatINR(addedPolicy.totalPremium)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>COMMENCEMENT DATE</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{formatDate(addedPolicy.dateOfCommencement)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRetake}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12.5px' }}
                >
                  Scan Another
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleViewPolicy}
                  style={{ flex: 1.5, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>View in Register</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* STATE 0: IDLE (User can manually click to open camera or upload) */}
          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', padding: '10px 0' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Camera size={30} />
              </div>

              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-main)' }}>
                  Capture Policy Document
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Take a photo of an LIC policy bond, FPR receipt, or ledger page.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-gold"
                onClick={triggerCamera}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Camera size={18} />
                <span>Open Camera Now</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
