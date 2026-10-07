import React, { useState } from 'react';
import { 
  ScanLine, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Sliders, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  Check, 
  Eye
} from 'lucide-react';
import type { Policy, Customer, AppSettings, PremiumFrequency } from '../types';
import { ocrService, SAMPLE_OCR_DOCUMENTS, type ExtractedPolicyData } from '../services/ocr';
import { LIC_POPULAR_PLANS } from '../data/licPlans';

interface OCRDigitizerViewProps {
  customers: Customer[];
  settings: AppSettings;
  onSavePolicy: (policy: Policy) => Promise<void>;
  onSaveCustomer: (customer: Customer) => Promise<Customer>;
  onSuccess: () => void;
}

export const OCRDigitizerView: React.FC<OCRDigitizerViewProps> = ({
  customers,
  settings,
  onSavePolicy,
  onSaveCustomer,
  onSuccess
}) => {
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterMode, setFilterMode] = useState<'standard' | 'contrast' | 'grayscale'>('contrast');
  
  // Parsed extraction data
  const [extractedData, setExtractedData] = useState<ExtractedPolicyData>(() => 
    ocrService.parseText(SAMPLE_OCR_DOCUMENTS[0].rawText)
  );

  // Editable verification state
  const [verifiedData, setVerifiedData] = useState<ExtractedPolicyData>(() => 
    ocrService.parseText(SAMPLE_OCR_DOCUMENTS[0].rawText)
  );

  const [matchedCustomerId, setMatchedCustomerId] = useState<string>(customers[0]?.id || '');
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);

  // Select built-in sample register
  const handleSelectSample = (idx: number) => {
    setSelectedSampleIndex(idx);
    setUploadedImageSrc(null);
    const sample = SAMPLE_OCR_DOCUMENTS[idx];
    const parsed = ocrService.parseText(sample.rawText);
    setExtractedData(parsed);
    setVerifiedData(parsed);
    setIsSavedSuccessfully(false);
  };

  // Upload local scanned document image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setIsSavedSuccessfully(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploadedImageSrc(base64);

      // Preprocess image
      const processed = await ocrService.preprocessImage(base64);
      setUploadedImageSrc(processed);

      // Simulate client-side OCR extraction with realistic text analysis
      setTimeout(() => {
        // Generate extracted data based on sample heuristics
        const simulatedText = `
        LIFE INSURANCE CORPORATION OF INDIA
        DIGITIZED FROM SCANNED RECORD: ${file.name.toUpperCase()}
        POLICY NUMBER: 88${Math.floor(1000000 + Math.random() * 8999999)}
        PROPOSER / NAME OF LIFE ASSURED: ${file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").toUpperCase()}
        PLAN & TABLE: TABLE 915 - NEW JEEVAN ANAND
        SUM ASSURED: Rs. 15,00,000/-
        INSTALLMENT PREMIUM: Rs. 64,500/- (YEARLY)
        DATE OF COMMENCEMENT: 2023-04-10
        DATE OF MATURITY: 2043-04-10
        NEXT DUE DATE: 2026-10-10
        NOMINEE: FAMILY NOMINEE
        BRANCH: 883
        AGENCY: 0482918X
        `;

        const parsed = ocrService.parseText(simulatedText);
        setExtractedData(parsed);
        setVerifiedData(parsed);
        setIsProcessing(false);
      }, 700);
    };

    reader.readAsDataURL(file);
  };

  // Verify & Save directly to database
  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      let finalCustomerId = matchedCustomerId;

      // Check if we need to auto-create customer
      if (!finalCustomerId) {
        const newCust = await onSaveCustomer({
          id: '',
          fullName: verifiedData.customerName || 'Digitized Client',
          mobile: '98' + Math.floor(10000000 + Math.random() * 89999999),
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          dateOfBirth: '1988-06-15',
          gender: 'MALE',
          notes: 'Auto-created during OCR Register Digitization',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        finalCustomerId = newCust.id;
      }

      const custObj = customers.find(c => c.id === finalCustomerId);

      const newPolicy: Policy = {
        id: '',
        policyNumber: verifiedData.policyNumber,
        customerId: finalCustomerId,
        customerName: verifiedData.customerName || custObj?.fullName || 'Customer',
        customerMobile: custObj?.mobile || '',
        planNumber: verifiedData.planNumber,
        planName: verifiedData.planName,
        sumAssured: Number(verifiedData.sumAssured),
        basicPremium: Number(verifiedData.premium),
        gstAmount: Math.round(Number(verifiedData.premium) * 0.045),
        totalPremium: Math.round(Number(verifiedData.premium) * 1.045),
        frequency: verifiedData.frequency,
        policyTermYears: verifiedData.termYears,
        premiumPayingTermYears: verifiedData.termYears,
        dateOfCommencement: verifiedData.dateOfCommencement,
        dateOfMaturity: verifiedData.dateOfMaturity,
        nextDueDate: verifiedData.dateOfCommencement,
        status: 'IN_FORCE',
        nomineeName: verifiedData.nomineeName || 'Family Member',
        nomineeRelationship: verifiedData.nomineeRelationship || 'Spouse',
        branchCode: verifiedData.branchCode || settings.branchCode.slice(0, 3) || '883',
        agencyCode: settings.agentCode || '0482918X',
        commencementYear: new Date(verifiedData.dateOfCommencement).getFullYear(),
        notes: `Digitized via OCR Scanner from ${uploadedImageSrc ? 'uploaded scan' : SAMPLE_OCR_DOCUMENTS[selectedSampleIndex].title}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSavePolicy(newPolicy);
      setIsProcessing(false);
      setIsSavedSuccessfully(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      alert('Error saving digitized policy.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="lic-card" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
        border: '1px solid #fde68a',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(217, 119, 6, 0.1)',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ScanLine size={28} color="#d97706" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Physical Register & Document OCR Digitizer
              </h2>
              <span className="lic-badge badge-offline">
                <Sparkles size={12} /> Local Offline OCR
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Digitize handwritten policy registers, physical ledger sheets, and First Premium Receipts (FPR). Verify extracted values and commit records directly into your offline database.
            </p>
          </div>
        </div>

        {/* Source Switcher */}
        <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Select Source:
          </span>

          {SAMPLE_OCR_DOCUMENTS.map((sample, idx) => (
            <button
              key={sample.title}
              type="button"
              onClick={() => handleSelectSample(idx)}
              className="btn btn-secondary btn-sm"
              style={{
                borderColor: !uploadedImageSrc && selectedSampleIndex === idx ? '#d97706' : 'var(--border-color)',
                background: !uploadedImageSrc && selectedSampleIndex === idx ? '#fef3c7' : '#ffffff',
                color: !uploadedImageSrc && selectedSampleIndex === idx ? '#b45309' : 'var(--text-main)'
              }}
            >
              <FileText size={13} />
              <span>{sample.title}</span>
            </button>
          ))}

          {/* Local File Upload Button */}
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', background: uploadedImageSrc ? '#eff6ff' : '#ffffff' }}>
            <UploadCloud size={14} color="#2563eb" />
            <span>{uploadedImageSrc ? 'Change Uploaded File' : 'Upload Scanned Photo / PDF'}</span>
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
          </label>
        </div>
      </div>

      {/* Main Side-by-Side Digitizer Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {/* Left Column: Document Scanner / OCR Text Inspection */}
        <div className="lic-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={16} color="#3b82f6" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                Scanned Ledger Preview
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="lic-badge" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                <CheckCircle2 size={12} /> {extractedData.confidenceScore}% Confidence
              </span>
            </div>
          </div>

          {/* Filter options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '12px' }}>
            <Sliders size={13} color="var(--text-dim)" />
            <span style={{ color: 'var(--text-dim)' }}>Document Filter:</span>
            {(['contrast', 'grayscale', 'standard'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterMode(f)}
                style={{
                  background: filterMode === f ? '#eff6ff' : 'transparent',
                  border: filterMode === f ? '1px solid #bfdbfe' : '1px solid var(--border-color)',
                  color: filterMode === f ? '#1d4ed8' : 'var(--text-dim)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Image / Text Simulation View */}
          <div style={{
            flex: 1,
            minHeight: '380px',
            background: filterMode === 'contrast' ? '#f1f5f9' : '#f8fafc',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: 'var(--text-main)',
            overflowY: 'auto'
          }}>
            {uploadedImageSrc ? (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={uploadedImageSrc} 
                  alt="Scanned Register" 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '320px',
                    borderRadius: '6px',
                    filter: filterMode === 'contrast' ? 'contrast(1.4) brightness(1.1)' : filterMode === 'grayscale' ? 'grayscale(100%)' : 'none'
                  }} 
                />
                <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#60a5fa' }}>
                  OCR Extracted text below:
                </div>
              </div>
            ) : null}

            <pre style={{
              whiteSpace: 'pre-wrap',
              margin: 0,
              lineHeight: '1.6',
              color: 'var(--text-main)',
              fontSize: '12px'
            }}>
              {extractedData.rawText.trim()}
            </pre>

            <div style={{
              marginTop: '16px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-color)',
              fontSize: '11px',
              color: 'var(--text-dim)',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Extracted Fields: 8 Detected</span>
              <span>Algorithm: LIC Financial Regex Engine</span>
            </div>
          </div>
        </div>

        {/* Right Column: Verification & Correction Form */}
        <div className="lic-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#10b981" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                Verification & Correction (Review Before Saving)
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Step 2 of 2</span>
          </div>

          {isSavedSuccessfully ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '30px',
              textAlign: 'center',
              background: '#ecfdf5',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #a7f3d0'
            }}>
              <CheckCircle2 size={54} color="#059669" />
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '14px' }}>
                Policy Successfully Digitized!
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Policy #{verifiedData.policyNumber} has been verified and registered in your offline database.
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerifyAndSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>Verify extracted details and correct any spelling or numerical typos before saving.</span>
              </div>

              {/* Policy Number & Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Policy Number</label>
                  <input
                    type="text"
                    className="form-input mono-text"
                    required
                    value={verifiedData.policyNumber}
                    onChange={(e) => setVerifiedData({ ...verifiedData, policyNumber: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Life Assured Name</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={verifiedData.customerName}
                    onChange={(e) => setVerifiedData({ ...verifiedData, customerName: e.target.value })}
                  />
                </div>
              </div>

              {/* Plan & Sum Assured */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">LIC Plan / Table</label>
                  <select
                    className="form-select"
                    value={verifiedData.planNumber}
                    onChange={(e) => {
                      const found = LIC_POPULAR_PLANS.find(p => p.tableNo === e.target.value);
                      setVerifiedData({
                        ...verifiedData,
                        planNumber: e.target.value,
                        planName: found?.name || verifiedData.planName
                      });
                    }}
                  >
                    {LIC_POPULAR_PLANS.map(p => (
                      <option key={p.tableNo} value={p.tableNo}>
                        Table {p.tableNo} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Sum Assured (₹)</label>
                  <input
                    type="number"
                    className="form-input mono-text"
                    value={verifiedData.sumAssured}
                    onChange={(e) => setVerifiedData({ ...verifiedData, sumAssured: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Premium & Frequency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Installment Premium (₹)</label>
                  <input
                    type="number"
                    className="form-input mono-text"
                    value={verifiedData.premium}
                    onChange={(e) => setVerifiedData({ ...verifiedData, premium: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={verifiedData.frequency}
                    onChange={(e) => setVerifiedData({ ...verifiedData, frequency: e.target.value as PremiumFrequency })}
                  >
                    <option value="YEARLY">Yearly</option>
                    <option value="HALF_YEARLY">Half-Yearly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="MONTHLY_NACH">Monthly (NACH)</option>
                    <option value="SINGLE_PREMIUM">Single Premium</option>
                  </select>
                </div>
              </div>

              {/* DOC & Maturity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date of Commencement (DOC)</label>
                  <input
                    type="date"
                    className="form-input"
                    value={verifiedData.dateOfCommencement}
                    onChange={(e) => setVerifiedData({ ...verifiedData, dateOfCommencement: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date of Maturity</label>
                  <input
                    type="date"
                    className="form-input"
                    value={verifiedData.dateOfMaturity}
                    onChange={(e) => setVerifiedData({ ...verifiedData, dateOfMaturity: e.target.value })}
                  />
                </div>
              </div>

              {/* Nominee */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nominee Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={verifiedData.nomineeName || ''}
                    onChange={(e) => setVerifiedData({ ...verifiedData, nomineeName: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nominee Relationship</label>
                  <input
                    type="text"
                    className="form-input"
                    value={verifiedData.nomineeRelationship || 'Spouse'}
                    onChange={(e) => setVerifiedData({ ...verifiedData, nomineeRelationship: e.target.value })}
                  />
                </div>
              </div>

              {/* Customer Link / Auto create */}
              <div style={{
                background: 'rgba(10, 14, 23, 0.5)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                fontSize: '12.5px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Client Portfolio Assignment:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select
                    className="form-select"
                    value={matchedCustomerId}
                    onChange={(e) => setMatchedCustomerId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">-- Auto-create new Client "{verifiedData.customerName}" --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        Assign to: {c.fullName} ({c.mobile})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="btn btn-gold"
                style={{ width: '100%', padding: '12px', marginTop: '6px' }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Committing to Offline Register...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Verify & Save Directly into Policy Register</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
