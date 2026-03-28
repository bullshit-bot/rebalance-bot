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
        className={`w-10 h-[22px] rounded-full border-[2px] border-foreground relative transition-colors flex-shrink-0 ${value ? "bg-primary" : "bg-secondary"}`}
      >
        <span
          className={`absolute top-[1px] left-[2px] w-3.5 h-3.5 rounded-full bg-card border-[1.5px] border-foreground transition-all ${
            value ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
