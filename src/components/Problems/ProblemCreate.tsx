import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Bug } from 'lucide-react';
import clsx from 'clsx';
import { useCreateProblem } from '../../hooks/useProblems';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'P1' | 'P2' | 'P3' | 'P4';

interface FormData {
  shortDescription: string;
  description: string;
  priority: Priority;
  category: string;
  assignmentGroupId: string;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'P1', label: 'P1 - Critical' },
  { value: 'P2', label: 'P2 - High' },
  { value: 'P3', label: 'P3 - Medium' },
  { value: 'P4', label: 'P4 - Low' },
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

const priorityClass: Record<Priority, string> = {
  P1: 'priority-p1',
  P2: 'priority-p2',
  P3: 'priority-p3',
  P4: 'priority-p4',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProblemCreate() {
  const navigate = useNavigate();
  const createProblem = useCreateProblem();

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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      shortDescription: '',
      description: '',
      priority: 'P3',
      category: '',
      assignmentGroupId: '',
    },
  });

  const selectedPriority = watch('priority');

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      state: 'NEW',
    };
    try {
      await createProblem.mutateAsync(payload);
      toast.success('Problem created successfully');
      navigate('/problems');
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to create problem';
      toast.error(message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate('/problems')} className="flex items-center gap-1.5 text-slate-400 hover:text-ink text-sm transition-colors">
              <ArrowLeft size={14} /> Problems
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm">Create</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--argus-elevated)] flex items-center justify-center">
              <Bug size={20} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-ink">Create New Problem</h1>
              <p className="text-slate-400 text-sm mt-0.5">Document and track a root cause investigation</p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent -mt-5 mb-5" />

      {/* Form card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 md:p-8">

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Short Description */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Short Description <span className="text-crimson">*</span>
            </label>
            <input
              type="text"
              placeholder="Brief summary of the problem"
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Detailed description of the problem, root cause hypothesis, affected services..."
              className="input-field resize-y min-h-[100px]"
              {...register('description')}
            />
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Priority
              </label>
              <select className="input-field" {...register('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <span
                  className={clsx('badge text-sm', priorityClass[selectedPriority])}
                >
                  {PRIORITIES.find((p) => p.value === selectedPriority)?.label}
                </span>
              </div>
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

          {/* Assignment Group */}
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

          {/* Divider */}
          <div className="border-t border-stone-200" />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/problems')}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createProblem.isPending}
              className={clsx(
                'btn-primary flex items-center gap-2',
                (isSubmitting || createProblem.isPending) && 'opacity-60 cursor-not-allowed',
              )}
            >
              <Save size={16} />
              {isSubmitting || createProblem.isPending ? 'Creating...' : 'Create Problem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
