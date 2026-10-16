type ToggleControlProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** A labelled switch row following the range controls' two-line rhythm. */
export function ToggleControl({
  label,
  checked,
  onChange,
}: ToggleControlProps) {
  return (
    <div className='flex flex-col gap-2.5'>
      <span className='text-sm text-[#a19b96]'>{label}</span>
      <button
        type='button'
        role='switch'
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 cursor-pointer self-start rounded-full border transition-colors ${
          checked
            ? 'border-[#e8e2dc] bg-[#e8e2dc]'
            : 'border-white/[0.17] bg-white/[0.055]'
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-4 rounded-full transition-transform ${
            checked ? 'translate-x-5 bg-[#181513]' : 'bg-[#eee9e4]'
          }`}
          aria-hidden='true'
        />
      </button>
    </div>
  );
}
