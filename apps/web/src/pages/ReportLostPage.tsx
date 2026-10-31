import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormInput, FormTextarea, FormSelect } from '../components/FormInput';
import { itemsService } from '../services/itemsService';
import { CATEGORIES } from '../utils/formatters';
import { Search, CheckCircle2, ArrowRight } from 'lucide-react';
import { z } from 'zod';

const lostSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  lost_location: z.string().min(3, 'Location is required'),
  lost_date: z.string().min(1, 'Date is required'),
});

export const ReportLostPage: React.FC = () => {
  const navigate = useNavigate();

  const [category, setCategory] = useState('ELECTRONICS');
  const [description, setDescription] = useState('');
  const [lostLocation, setLostLocation] = useState('');
  const [lostDate, setLostDate] = useState(new Date().toISOString().slice(0, 16));
  const [serialNumber, setSerialNumber] = useState('');
  const [identifyingMarks, setIdentifyingMarks] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const validation = lostSchema.safeParse({
      category,
      description,
      lost_location: lostLocation,
      lost_date: lostDate,
    });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const attributes: Record<string, any> = {};
      if (serialNumber.trim()) attributes.serial_number = serialNumber.trim();
      if (identifyingMarks.trim()) attributes.identifying_marks = identifyingMarks.trim();

      const res = await itemsService.reportLost({
        category,
        description,
        lost_location: lostLocation,
        lost_date: lostDate,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      });

      setSuccessResult(res);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit lost item report');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Lost Item Report Recorded</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Our background matching engine will cross-reference newly reported found assets against your report.
          You will receive immediate notification upon confidence threshold detection.
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <button
            onClick={() => navigate('/items')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
          >
            Browse Open Items Now
          </button>
          <button
            onClick={() => {
              setSuccessResult(null);
              setDescription('');
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
          >
            File Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Report a Lost Item</h1>
        <p className="text-sm text-slate-500">
          Describe the item you lost. We will match your submission against found item reports.
        </p>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-5">
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
          label="Description of Lost Item"
          placeholder="Describe brand, model, color, appearance, and any recognizable details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          rows={3}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Approximate Location Lost"
            placeholder="e.g. Student Center, Cafeteria"
            value={lostLocation}
            onChange={(e) => setLostLocation(e.target.value)}
            error={errors.lost_location}
            required
          />

          <FormInput
            label="Date & Time Lost"
            type="datetime-local"
            value={lostDate}
            onChange={(e) => setLostDate(e.target.value)}
            error={errors.lost_date}
            required
          />
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Distinguishing Features (Optional)
          </h4>

          <FormInput
            label="Serial Number or Unique Identifiers"
            placeholder="e.g. C02G8764MD6T"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />

          <FormInput
            label="Stickers, Scratches, or Contents"
            placeholder="e.g. Blue star sticker on bottom, chipped corner"
            value={identifyingMarks}
            onChange={(e) => setIdentifyingMarks(e.target.value)}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
          >
            {submitting ? 'Registering...' : 'Submit Lost Report'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
