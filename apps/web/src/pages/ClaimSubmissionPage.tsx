import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FormInput, FormTextarea } from '../components/FormInput';
import { claimsService } from '../services/claimsService';
import { workflowService, ChallengeQuestion } from '../services/workflowService';
import { itemsService } from '../services/itemsService';
import { ItemDetail, Claim } from '../kernel/types';
import { ScoreGuidanceBanner } from '../components/ScoreGuidanceBanner';
import { ShieldCheck, ArrowRight, HelpCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const claimSchema = z.object({
  description: z.string().min(10, 'Please describe your ownership details (at least 10 characters)'),
  lost_location: z.string().min(3, 'Location lost is required'),
  lost_date: z.string().min(1, 'Date lost is required'),
});

export const ClaimSubmissionPage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loadingItem, setLoadingItem] = useState(true);

  // Phase 1: Claim attributes
  const [description, setDescription] = useState('');
  const [lostLocation, setLostLocation] = useState('');
  const [lostDate, setLostDate] = useState(new Date().toISOString().slice(0, 16));
  const [serialNumber, setSerialNumber] = useState('');
  const [distinctiveMarks, setDistinctiveMarks] = useState('');
  const [contents, setContents] = useState('');

  // Phase 2: Questions & Scoring
  const [createdClaim, setCreatedClaim] = useState<Claim | null>(null);
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluatedClaim, setEvaluatedClaim] = useState<Claim | null>(null);

  const [step, setStep] = useState<'INITIAL' | 'QUESTIONS' | 'RESULT'>('INITIAL');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItem() {
      if (!itemId) return;
      try {
        const data = await itemsService.getItem(itemId);
        setItem(data);
      } catch (err: any) {
        setSubmitError(err.message || 'Item not found');
      } finally {
        setLoadingItem(false);
      }
    }
    loadItem();
  }, [itemId]);

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const validation = claimSchema.safeParse({ description, lost_location: lostLocation, lost_date: lostDate });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!itemId) return;

    setSubmitting(true);
    try {
      const claimedAttributes: Record<string, any> = {};
      if (serialNumber.trim()) claimedAttributes.serial_number = serialNumber.trim();
      if (distinctiveMarks.trim()) claimedAttributes.distinctive_marks = distinctiveMarks.trim();
      if (contents.trim()) claimedAttributes.contents = contents.trim();

      const claim = await claimsService.submitClaim({
        item_id: itemId,
        description,
        claimed_attributes: claimedAttributes,
        lost_date: lostDate,
        lost_location: lostLocation,
      });

      setCreatedClaim(claim);

      // Fetch challenge questions
      try {
        const qList = await workflowService.getQuestions(claim.id);
        if (qList && qList.length > 0) {
          setQuestions(qList);
          setStep('QUESTIONS');
        } else {
          // No challenge questions, evaluate directly
          const evaluated = await workflowService.evaluateClaim(claim.id);
          setEvaluatedClaim(evaluated);
          setStep('RESULT');
        }
      } catch {
        // Direct evaluate fallback
        const evaluated = await workflowService.evaluateClaim(claim.id);
        setEvaluatedClaim(evaluated);
        setStep('RESULT');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleQuestionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdClaim) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await workflowService.submitAnswers(createdClaim.id, answers);
      const evaluated = await workflowService.evaluateClaim(createdClaim.id);
      setEvaluatedClaim(evaluated);
      setStep('RESULT');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to evaluate challenge answers');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingItem) {
    return <div className="p-12 text-center text-sm text-slate-500">Loading claim interface...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to={itemId ? `/items/${itemId}` : '/items'}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Cancel & Return
      </Link>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Claim Asset Ownership</h1>
        <p className="text-xs text-slate-500">
          Item: <span className="font-semibold text-slate-700">{item?.public_description}</span>
        </p>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {submitError}
        </div>
      )}

      {/* Step 1: Initial Claim Form */}
      {step === 'INITIAL' && (
        <form onSubmit={handleInitialSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
            <p className="font-bold">Zero-Knowledge Verification Step 1</p>
            <p className="text-blue-700">
              Provide proof of ownership. Specific characteristics and private details will be compared
              cryptographically and semantically against the finder&apos;s sealed report.
            </p>
          </div>

          <FormTextarea
            label="Detailed Description of Your Item"
            placeholder="Describe your item in detail: make, model, color, special traits, wallpaper, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            rows={3}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Where did you lose it?"
              placeholder="e.g. Science Library, 2nd floor"
              value={lostLocation}
              onChange={(e) => setLostLocation(e.target.value)}
              error={errors.lost_location}
              required
            />

            <FormInput
              label="When did you lose it?"
              type="datetime-local"
              value={lostDate}
              onChange={(e) => setLostDate(e.target.value)}
              error={errors.lost_date}
              required
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Cryptographic / Distinctive Attributes
            </h4>

            <FormInput
              label="Serial Number (Exact or partial)"
              placeholder="e.g. C02G8764MD6T"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              helperText="Exact match yields high structured confidence."
            />

            <FormInput
              label="Stickers, Scratches, Engravings"
              placeholder="e.g. NASA circular sticker, corner scratch"
              value={distinctiveMarks}
              onChange={(e) => setDistinctiveMarks(e.target.value)}
            />

            <FormInput
              label="Contents or Compartment Items"
              placeholder="e.g. Black ballpoint pen, blue student ID"
              value={contents}
              onChange={(e) => setContents(e.target.value)}
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Verifying...' : 'Submit Claim & Proceed'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Ownership Challenge Questions */}
      {step === 'QUESTIONS' && (
        <form onSubmit={handleQuestionsSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <HelpCircle className="w-4 h-4 text-purple-600" />
              <span>Step 2: Ownership Challenge Questions</span>
            </div>
            <p className="text-purple-700">
              Answer the following specific questions generated from the item&apos;s registered traits to confirm your ownership.
            </p>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Question {idx + 1}: {q.question}
                </label>
                <input
                  type="text"
                  placeholder="Your answer..."
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  required
                />
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Evaluating Proofs...' : 'Submit Answers'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Evaluation Result */}
      {step === 'RESULT' && evaluatedClaim && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Claim Evaluation Complete</h2>
            <p className="text-xs text-slate-500">
              Claim ID: <span className="font-mono">{evaluatedClaim.id}</span>
            </p>
          </div>

          <ScoreGuidanceBanner
            score={evaluatedClaim.final_score}
            confidenceLabel={evaluatedClaim.confidence_label}
          />

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border text-center">
              <span className="text-slate-400 block">Structured Score</span>
              <span className="text-sm font-bold text-slate-800">
                {Math.round(evaluatedClaim.structured_score || 0)} / 100
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border text-center">
              <span className="text-slate-400 block">Semantic Score</span>
              <span className="text-sm font-bold text-slate-800">
                {Math.round(evaluatedClaim.semantic_score || 0)} / 100
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl text-xs space-y-2 text-slate-700 border">
            <p className="font-bold text-slate-800">Current Status: {evaluatedClaim.status}</p>
            {evaluatedClaim.status === 'APPROVED' ? (
              <p className="text-emerald-700 font-medium">
                Congratulations! Your claim was approved. A pickup authorization with an HMAC QR code
                and single-use OTP is now ready for collection at the security desk.
              </p>
            ) : evaluatedClaim.status === 'MANUAL_REVIEW' ? (
              <p className="text-amber-800">
                Your claim has been queued for security desk manual review. Security staff may inspect
                physical traits with you at the desk before handover.
              </p>
            ) : (
              <p className="text-slate-600">
                Your claim is on file. Please monitor your notifications for updates from the security desk.
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            {evaluatedClaim.status === 'APPROVED' ? (
              <Link
                to={`/collection/${evaluatedClaim.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow transition"
              >
                View Collection QR & OTP &rarr;
              </Link>
            ) : null}
            <Link
              to="/my-claims"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
            >
              Go to My Claims
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
