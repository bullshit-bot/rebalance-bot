// Reusable toggle switch for strategy config boolean fields

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-foreground/10 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full border-[2px] border-foreground relative transition-colors flex-shrink-0 ${value ? "bg-primary" : "bg-secondary"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-card border-[1.5px] border-foreground transition-transform ${
            value ? "translate-x-[1.25rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
