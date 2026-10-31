import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormInput, FormTextarea, FormSelect } from '../components/FormInput';
import { itemsService } from '../services/itemsService';
import { CATEGORIES } from '../utils/formatters';
import { ShieldCheck, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

const step1Schema = z.object({
  category: z.string().min(1, 'Please select a category'),
  public_description: z.string().min(10, 'Public description must be at least 10 characters'),
  found_location_public: z.string().min(3, 'Location is required'),
  found_date: z.string().min(1, 'Found date is required'),
});

export const ReportFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Public fields
  const [category, setCategory] = useState('ELECTRONICS');
  const [publicDescription, setPublicDescription] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [foundDate, setFoundDate] = useState(new Date().toISOString().slice(0, 16));

  // Step 2: Hidden fields
  const [hiddenDescription, setHiddenDescription] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [stickersOrMarks, setStickersOrMarks] = useState('');
  const [containedItems, setContainedItems] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleNextStep = () => {
    setErrors({});
    const validation = step1Schema.safeParse({
      category,
      public_description: publicDescription,
      found_location_public: foundLocation,
      found_date: foundDate,
    });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const hiddenAttrs: Record<string, any> = {};
      if (serialNumber.trim()) hiddenAttrs.serial_number = serialNumber.trim();
      if (stickersOrMarks.trim()) hiddenAttrs.stickers_or_marks = stickersOrMarks.trim();
      if (containedItems.trim()) hiddenAttrs.contained_items = containedItems.trim();

      const item = await itemsService.reportFound({
        category,
        public_description: publicDescription,
        found_location_public: foundLocation,
        found_date: foundDate,
        hidden_description: hiddenDescription.trim() || undefined,
        hidden_attributes: Object.keys(hiddenAttrs).length > 0 ? hiddenAttrs : undefined,
      });

      navigate(`/items/${item.id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit found item report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Report a Found Item</h1>
        <p className="text-sm text-slate-500">
          Help return lost property safely. Distinguish between public appearance and private proofs.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 py-2">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
            step === 1 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Step 1: Public Broad Visuals</span>
        </div>
        <div className="w-8 h-0.5 bg-slate-200"></div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
            step === 2 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Step 2: Private Identifying Proofs</span>
        </div>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {submitError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        {step === 1 ? (
          <div className="space-y-5">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <Eye className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900">
                <p className="font-semibold">Publicly Visible Information</p>
                <p className="text-blue-700 mt-0.5">
                  These broad details will be listed publicly on the campus directory so the rightful owner
                  can recognize that their item was found.
                </p>
              </div>
            </div>

            <FormSelect
              label="Item Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORIES.map((cat) => ({
                value: cat,
                label: cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' '),
              }))}
              required
            />

            <FormTextarea
              label="Public Description"
              placeholder="e.g. Silver 13-inch laptop in dark grey zippered neoprene sleeve"
              value={publicDescription}
              onChange={(e) => setPublicDescription(e.target.value)}
              error={errors.public_description}
              helperText="Do not include passwords, sticker text, or serial numbers here."
              rows={3}
              required
            />

            <FormInput
              label="Found Location (Public)"
              placeholder="e.g. Science Library, 2nd floor study carrels"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              error={errors.found_location_public}
              required
            />

            <FormInput
              label="Date & Time Found"
              type="datetime-local"
              value={foundDate}
              onChange={(e) => setFoundDate(e.target.value)}
              error={errors.found_date}
              required
            />

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
              >
                Continue to Step 2: Private Proofs
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 2 Banner */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
              <EyeOff className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-purple-900">
                <p className="font-bold uppercase tracking-wider text-[11px] text-purple-700">
                  Zero-Knowledge Proof Guard
                </p>
                <p className="font-semibold text-sm mt-0.5">Never Shown Publicly</p>
                <p className="text-purple-700 mt-1">
                  These attributes are strictly concealed and stored in encrypted form. They are used exclusively
                  to challenge claimants with verification questions before release.
                </p>
              </div>
            </div>

            <FormTextarea
              label="Hidden Description / Internal Distinctive Traits"
              placeholder="e.g. Small scratch on bottom right edge; lock screen wallpaper is a golden retriever"
              value={hiddenDescription}
              onChange={(e) => setHiddenDescription(e.target.value)}
              helperText="Only verified security staff and matching algorithms can access this."
              rows={3}
            />

            <FormInput
              label="Serial Number or Unique ID (if visible)"
              placeholder="e.g. C02G8764MD6T"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />

            <FormInput
              label="Unique Stickers, Keychains, or Engravings"
              placeholder="e.g. NASA circular sticker on top lid, green carabiner on zipper"
              value={stickersOrMarks}
              onChange={(e) => setStickersOrMarks(e.target.value)}
            />

            <FormInput
              label="Items Inside / Pocket Contents"
              placeholder="e.g. USB drive, mechanical pencil, student metro card"
              value={containedItems}
              onChange={(e) => setContainedItems(e.target.value)}
            />

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Step 1
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
              >
                {submitting ? 'Registering Item...' : 'Submit Found Item'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
