import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { handoverService, ClaimQrResponse } from '../services/handoverService';
import { claimsService } from '../services/claimsService';
import { Claim } from '../kernel/types';
import { formatTimeRemaining, formatDate } from '../utils/date';
import { QrCode, Clock, ShieldCheck, AlertCircle, ArrowLeft, RefreshCw, KeyRound, Bell } from 'lucide-react';

export const ApprovedCollectionPage: React.FC = () => {
  const { claimId } = useParams<{ claimId: string }>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [qrData, setQrData] = useState<ClaimQrResponse | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!claimId) return;
    setLoading(true);
    setError(null);
    try {
      const [claimRes, qrRes] = await Promise.all([
        claimsService.getClaim(claimId),
        handoverService.getClaimQr(claimId),
      ]);
      setClaim(claimRes);
      setQrData(qrRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load collection authorization token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [claimId]);

  useEffect(() => {
    if (!qrData?.expiresAt) return;
    const updateCountdown = () => {
      setTimeRemaining(formatTimeRemaining(qrData.expiresAt));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [qrData?.expiresAt]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Generating collection pass...</div>;
  }

  if (error || !qrData) {
    return (
      <div className="max-w-md mx-auto my-8 bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-red-900">Collection Pass Unavailable</h2>
        <p className="text-xs text-red-700">{error || 'Could not retrieve QR token.'}</p>
        <Link
          to="/my-claims"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-red-300 text-red-800 rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Return to My Claims
        </Link>
      </div>
    );
  }

  const isExpired = timeRemaining === 'Expired';

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link
        to="/my-claims"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Claims
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Pass Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-6 text-white text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5" /> Approved Collection Pass
          </div>
          <h1 className="text-xl font-bold">Campus Security Handover Pass</h1>
          <p className="text-xs text-emerald-100 font-mono">Claim ID: {claimId}</p>
        </div>

        {/* OTP Notification Banner */}
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-bold">6-Digit Release OTP Sent to Notifications</p>
            <p className="text-amber-800">
              A single-use 6-digit OTP has been dispatched to your in-app notification bell.
              You must present <strong>both</strong> this QR code and the 6-digit OTP to the security desk officer.
            </p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="p-8 text-center space-y-6">
          <div className="relative inline-block p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-inner">
            {/* Visual SVG QR Representation */}
            <div className="w-56 h-56 bg-white border border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center mx-auto shadow-sm">
              <QrCode className="w-36 h-36 text-slate-800" />
              <span className="text-[10px] text-slate-400 font-mono mt-2 uppercase tracking-widest">
                HMAC-SHA256 SECURED
              </span>
            </div>

            {isExpired && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 text-white">
                <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
                <p className="font-bold text-sm">Token Expired</p>
                <p className="text-xs text-slate-300 mt-1">Please regenerate a new pass</p>
              </div>
            )}
          </div>

          {/* Token String & Expiry Countdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs">
              <Clock className={`w-4 h-4 ${isExpired ? 'text-red-500' : 'text-emerald-600'}`} />
              <span className="font-semibold text-slate-700">Token Validity:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded ${
                  isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {timeRemaining}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Signed Token Payload:
              </span>
              <p className="font-mono text-xs text-slate-800 break-all select-all mt-1 bg-white p-2 rounded border">
                {qrData.qrToken}
              </p>
            </div>
          </div>

          {/* Desk Instructions */}
          <div className="text-xs text-slate-500 text-left bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-1.5">
            <p className="font-bold text-blue-950">At the Security Desk:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-900">
              <li>Show this QR screen to the officer for optical scanning or manual token entry.</li>
              <li>Provide the 6-digit OTP found in your Notification Bell.</li>
              <li>If the item is marked <strong>HIGH RISK</strong>, bring your campus student ID card or government photo ID.</li>
            </ul>
          </div>

          <div className="flex justify-center">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Token Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
