import { useId, useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { inputClass, primaryBtn } from './styles';

const LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

/**
 * 1–5 star picker built on native radio inputs, so arrow keys / Tab / Space work
 * out of the box and screen readers announce "3 stars, Okay, 3 of 5".
 */
export function StarRating({ value, onChange, name, legend }: {
  value: number; onChange: (v: number) => void; name: string; legend: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-[#0F172A]">{legend}</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= shown;
          return (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'} – ${LABELS[n - 1]}`}
                className="peer sr-only"
              />
              <span className="flex h-10 w-10 items-center justify-center rounded-lg transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#4F46E5] peer-focus-visible:ring-offset-1">
                <Star
                  aria-hidden="true"
                  className={`h-7 w-7 transition ${active ? 'fill-[#F59E0B] text-[#D97706]' : 'fill-transparent text-[#94A3B8]'}`}
                />
              </span>
            </label>
          );
        })}
        <span className="ml-2 min-w-[5rem] text-sm text-[#475569]" aria-hidden="true">
          {shown ? LABELS[shown - 1] : ''}
        </span>
      </div>
    </fieldset>
  );
}

/** Rating card: stars + optional comment + submit. Shows a thank-you line once rated. */
export function RatingPanel({ ratedScore, onSubmit, isPending, subject }: {
  ratedScore: number | null | undefined;
  onSubmit: (score: number, comment: string) => void;
  isPending: boolean;
  subject: string;
}) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const id = useId();

  if (ratedScore != null) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#166534]">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        You rated this {ratedScore}/5. Thanks for the feedback!
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (score < 1) return;
        onSubmit(score, comment.trim());
      }}
      className="space-y-4"
    >
      <StarRating value={score} onChange={setScore} name={`${id}-score`} legend={`How did we do with ${subject}?`} />
      {touched && score < 1 && (
        <p role="alert" className="text-sm text-[#B91C1C]">Please pick a rating from 1 to 5 stars.</p>
      )}
      <div>
        <label htmlFor={`${id}-comment`} className="mb-1 block text-sm font-medium text-[#0F172A]">
          Anything you'd like to add? <span className="font-normal text-[#475569]">(optional)</span>
        </label>
        <textarea
          id={`${id}-comment`}
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={inputClass}
          placeholder="Tell us what went well or what we could do better"
        />
      </div>
      <button type="submit" className={primaryBtn} disabled={isPending}>
        {isPending ? 'Sending…' : 'Send rating'}
      </button>
    </form>
  );
}
