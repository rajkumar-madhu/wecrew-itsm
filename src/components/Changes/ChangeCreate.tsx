import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import { useCreateChange } from '../../hooks/useChanges';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChangeType = 'NORMAL' | 'STANDARD' | 'EMERGENCY';
type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface ChangeFormData {
  shortDescription: string;
  description: string;
  type: ChangeType;
  riskLevel: RiskLevel;
  category: string;
  assignmentGroupId: string;
  justification: string;
  implementationPlan: string;
  rollbackPlan: string;
  testPlan: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const CHANGE_TYPES: { value: ChangeType; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const RISK_LEVELS: { value: RiskLevel; label: string }[] = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Database',
  'Security',
  'Cloud Infrastructure',
  'Application',
  'Monitoring',
  'Other',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChangeCreate() {
  const navigate = useNavigate();
  const createChange = useCreateChange();

  // Fetch teams from API
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data } = await api.get('/teams');
      return data;
    },
    staleTime: 60000,
  });

  const teams: { id: string; name: string }[] = teamsData?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeFormData>({
    defaultValues: {
      shortDescription: '',
      description: '',
      type: 'NORMAL',
      riskLevel: 'MEDIUM',
      category: '',
      assignmentGroupId: '',
      justification: '',
      implementationPlan: '',
      rollbackPlan: '',
      testPlan: '',
      plannedStartDate: '',
      plannedEndDate: '',
    },
  });

  const onSubmit = async (data: ChangeFormData) => {
    const payload: Record<string, any> = {
      ...data,
      state: 'NEW',
    };

    // Convert datetime-local strings to ISO format if provided
    if (data.plannedStartDate) {
      payload.plannedStartDate = new Date(data.plannedStartDate).toISOString();
    } else {
      delete payload.plannedStartDate;
    }
    if (data.plannedEndDate) {
      payload.plannedEndDate = new Date(data.plannedEndDate).toISOString();
    } else {
      delete payload.plannedEndDate;
    }

    // Remove empty optional strings
    if (!data.assignmentGroupId) delete payload.assignmentGroupId;

    try {
      await createChange.mutateAsync(payload);
      toast.success('Change request submitted successfully');
      navigate('/changes');
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to create change request';
      toast.error(message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[color:var(--argus-signal-dim)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate('/changes')} className="flex items-center gap-1.5 text-slate-400 hover:text-ink text-sm transition-colors">
              <ArrowLeft size={14} /> Changes
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm">Create</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--argus-elevated)] flex items-center justify-center">
              <GitBranch size={20} className="text-signal" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-ink">Create New Change</h1>
              <p className="text-slate-400 text-sm mt-0.5">Submit a change request for review and approval</p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent -mt-5 mb-5" />

      {/* Form card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 md:p-8">

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Row 1: Short Description (full width) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Short Description <span className="text-crimson">*</span>
            </label>
            <input
              type="text"
              placeholder="Brief summary of the change request"
              className={clsx(
                'input-field',
                errors.shortDescription &&
                  'border-crimson/60 focus:border-crimson/80 focus:ring-crimson/20',
              )}
              {...register('shortDescription', {
                required: 'Short description is required',
                minLength: { value: 3, message: 'Minimum 3 characters' },
              })}
            />
            {errors.shortDescription && (
              <p className="mt-1 text-xs text-crimson">
                {errors.shortDescription.message}
              </p>
            )}
          </div>

          {/* Row 2: Description (full width textarea) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Detailed description of the proposed change, affected systems, and scope..."
              className="input-field resize-y min-h-[100px]"
              {...register('description')}
            />
          </div>

          {/* Row 3: Type | Risk Level | Category (3-col grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Type
              </label>
              <select className="input-field" {...register('type')}>
                {CHANGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Risk Level
              </label>
              <select className="input-field" {...register('riskLevel')}>
                {RISK_LEVELS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Category
              </label>
              <select className="input-field" {...register('category')}>
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Assignment Group (full width) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Assignment Group
            </label>
            <select className="input-field" {...register('assignmentGroupId')}>
              <option value="">Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row 5: Justification (full width textarea) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Justification
            </label>
            <textarea
              rows={3}
              placeholder="Why is this change needed? Business impact, risk of not implementing..."
              className="input-field resize-y min-h-[80px]"
              {...register('justification')}
            />
          </div>

          {/* Row 6: Implementation Plan | Rollback Plan (2-col grid, textareas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Implementation Plan
              </label>
              <textarea
                rows={4}
                placeholder="Step-by-step implementation procedure..."
                className="input-field resize-y min-h-[100px]"
                {...register('implementationPlan')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Rollback Plan
              </label>
              <textarea
                rows={4}
                placeholder="Steps to revert the change if issues arise..."
                className="input-field resize-y min-h-[100px]"
                {...register('rollbackPlan')}
              />
            </div>
          </div>

          {/* Row 7: Test Plan (full width textarea) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Test Plan
            </label>
            <textarea
              rows={3}
              placeholder="How will the change be validated? Test cases, acceptance criteria..."
              className="input-field resize-y min-h-[80px]"
              {...register('testPlan')}
            />
          </div>

          {/* Row 8: Planned Start Date | Planned End Date (2-col grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Planned Start Date
              </label>
              <input
                type="datetime-local"
                className="input-field"
                {...register('plannedStartDate')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Planned End Date
              </label>
              <input
                type="datetime-local"
                className="input-field"
                {...register('plannedEndDate')}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-200" />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/changes')}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createChange.isPending}
              className={clsx(
                'btn-primary flex items-center gap-2',
                (isSubmitting || createChange.isPending) && 'opacity-60 cursor-not-allowed',
              )}
            >
              <Save size={16} />
              {isSubmitting || createChange.isPending ? 'Submitting...' : 'Submit Change Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
