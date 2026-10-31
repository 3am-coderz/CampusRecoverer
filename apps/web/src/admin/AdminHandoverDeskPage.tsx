import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { handoverService, DeskVerifyResult } from '../services/handoverService';
import { claimsService } from '../services/claimsService';
import { itemsService } from '../services/itemsService';
import { Claim, ItemDetail } from '../kernel/types';
import { FormInput } from '../components/FormInput';
import { StatusBadge } from '../components/StatusBadge';
import {
  QrCode,
  KeyRound,
  ShieldCheck,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';

export const AdminHandoverDeskPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [claimId, setClaimId] = useState(searchParams.get('claimId') || '');
  const [qrToken, setQrToken] = useState('');
  const [otp, setOtp] = useState('');
  const [photoIdVerified, setPhotoIdVerified] = useState(false);

  const [claim, setClaim] = useState<Claim | null>(null);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  // Verification state
  const [submitting, setSubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<DeskVerifyResult | null>(null);

  // Load claim/item context if claimId provided
  useEffect(() => {
    async function fetchContext() {
      if (!claimId.trim()) return;
      setLoadingContext(true);
      try {
        const c = await claimsService.getClaim(claimId.trim());
        setClaim(c);
        if (c.item_id) {
          const it = await itemsService.getItem(c.item_id);
          setItem(it);
        }
      } catch {
        // ignore load errors
      } finally {
        setLoadingContext(false);
      }
    }
    fetchContext();
  }, [claimId]);

  // Optical scanner toggle
  const toggleScanner = async () => {
    if (scanning) {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }
      setScanning(false);
      return;
    }

    setScanning(true);
    setScannerError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('qr-reader-container');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Parse token or payload
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.qrToken) setQrToken(parsed.qrToken);
            if (parsed.claimId) setClaimId(parsed.claimId);
          } catch {
            setQrToken(decodedText);
          }
          html5QrCode.stop().catch(() => {});
          setScanning(false);
        },
        (_errorMessage) => {
          // parse scan frame failures silently
        },
      );
    } catch (err: any) {
      setScannerError(err.message || 'Camera access not available or permission denied.');
      setScanning(false);
    }
  };

  const handleVerifyAndRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifySuccess(null);

    if (!claimId.trim()) {
      setVerifyError('Please enter or scan the Claim ID');
      return;
    }
    if (!qrToken.trim()) {
      setVerifyError('QR Token is required');
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      setVerifyError('Please enter the 6-digit OTP provided by the claimant');
      return;
    }

    if (item?.risk_level === 'HIGH' && !photoIdVerified) {
      setVerifyError('Mandatory High-Risk Protocol: Photo ID inspection must be verified prior to release');
      return;
    }

    setSubmitting(true);
    try {
      const result = await handoverService.deskVerify({
        claimId: claimId.trim(),
        qrToken: qrToken.trim(),
        otp: otp.trim(),
        photoIdVerified,
      });

      setVerifySuccess(result);
    } catch (err: any) {
      setVerifyError(err.message || 'Handover verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-purple-50 text-purple-700 rounded-2xl mb-1">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Security Desk Handover & Release</h1>
        <p className="text-xs text-slate-500">
          Verify HMAC-SHA256 authorization tokens, single-use OTPs, and physical identity credentials
        </p>
      </div>

      {verifySuccess ? (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xl p-8 text-center space-y-5 animate-in fade-in duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-emerald-900">Asset Handover Successful!</h2>
            <p className="text-xs text-emerald-700">
              Item status updated to <span className="font-mono font-bold">COLLECTED</span>. Tamper-evident custody receipt logged.
            </p>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-left space-y-2 text-emerald-900">
            <div className="flex justify-between">
              <span className="font-bold">Item:</span>
              <span>{verifySuccess.item?.public_description}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Claimant ID:</span>
              <span className="font-mono">{verifySuccess.claim?.claimant_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Custody Event ID:</span>
              <span className="font-mono">{verifySuccess.handoverEvent?.id || 'EVENT-CONFIRMED'}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setVerifySuccess(null);
              setQrToken('');
              setOtp('');
              setClaimId('');
              setPhotoIdVerified(false);
            }}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow transition"
          >
            Process Next Handover
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {verifyError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          {/* Context Preview if Item Loaded */}
          {item && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Releasing Asset:
                </span>
                <p className="font-bold text-slate-900 text-sm">{item.public_description}</p>
                <p className="text-slate-500 mt-0.5">Found at {item.found_location_public}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge risk={item.risk_level} />
                <StatusBadge status={item.status} />
              </div>
            </div>
          )}

          <form onSubmit={handleVerifyAndRelease} className="space-y-5">
            <FormInput
              label="Claim ID (UUID)"
              placeholder="e.g. 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              helperText="Enter the claimant's approved claim ID."
              required
            />

            {/* QR Token input with Camera Scan Button */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Signed QR Authorization Token <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={toggleScanner}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md text-xs font-semibold border border-purple-200 transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {scanning ? 'Close Camera' : 'Scan via Camera'}
                </button>
              </div>

              {scanning && (
                <div className="p-4 bg-slate-900 rounded-2xl text-center space-y-3">
                  <div
                    id="qr-reader-container"
                    className="w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-black"
                  ></div>
                  <p className="text-xs text-slate-300">Point optical scanner at claimant&apos;s phone screen</p>
                </div>
              )}

              {scannerError && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  {scannerError} (You can paste the token manually below).
                </p>
              )}

              <input
                type="text"
                placeholder="Paste token or scan QR..."
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                className="w-full px-3 py-2 border rounded-md shadow-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            {/* 6-Digit OTP */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Claimant 6-Digit OTP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full max-w-xs px-4 py-2 border rounded-md shadow-sm text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <p className="text-xs text-slate-500">
                Single-use code delivered directly to the claimant&apos;s notification inbox.
              </p>
            </div>

            {/* High-Risk Checkbox */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={photoIdVerified}
                  onChange={(e) => setPhotoIdVerified(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">
                    Photo ID Verified (Mandatory for High-Risk Assets)
                  </span>
                  <p className="text-slate-500 mt-0.5">
                    Officer has physically inspected claimant&apos;s student ID card or government-issued photo ID.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
              >
                <ShieldCheck className="w-5 h-5" />
                {submitting ? 'Verifying Release Authorization...' : 'Release Item to Claimant'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
