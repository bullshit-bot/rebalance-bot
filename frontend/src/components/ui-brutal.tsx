import { ReactNode, useState, useRef, useEffect, createContext, useContext, useCallback } from "react";
import { X, ChevronDown, ChevronRight, AlertCircle, CheckCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

// ════════════════════════════════════════════════════
//  TYPOGRAPHY
// ════════════════════════════════════════════════════

export function PageTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-bold mb-5">{children}</h2>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-bold mb-3">{children}</h3>;
}

export function BrutalLabel({ children, htmlFor, required }: { children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-bold mb-1 block">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

// ════════════════════════════════════════════════════
//  STAT CARD
// ════════════════════════════════════════════════════

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: "default" | "success" | "danger" | "warning" | "purple";
  icon?: ReactNode;
}

const statVariants = {
  default: "bg-card",
  success: "bg-success/10 border-success",
  danger: "bg-destructive/10 border-destructive",
  warning: "bg-warning/10 border-warning",
  purple: "bg-primary/10 border-primary",
};

export function StatCard({ label, value, subValue, variant = "default", icon }: StatCardProps) {
  return (
    <div className={`brutal-card ${statVariants[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="stat-label mb-1">{label}</div>
          <div className="stat-value">{value}</div>
          {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  BADGES (Domain-specific)
// ════════════════════════════════════════════════════

export function DriftBadge({ drift }: { drift: number }) {
  const abs = Math.abs(drift);
  let cls = "bg-success/15 text-success";
  if (abs > 3) cls = "bg-destructive/15 text-destructive";
  else if (abs > 1) cls = "bg-warning/15 text-warning-foreground";
  return (
    <span className={`brutal-badge ${cls}`}>
      {drift > 0 ? "+" : ""}{drift.toFixed(1)}%
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    buy: "bg-success/15 text-success",
    sell: "bg-destructive/15 text-destructive",
    hold: "bg-secondary text-muted-foreground",
    reduce: "bg-warning/15 text-warning-foreground",
  };
  return (
    <span className={`brutal-badge uppercase ${map[action] || map.hold}`}>
      {action}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground",
    warning: "bg-warning text-warning-foreground",
    info: "bg-primary/15 text-primary",
  };
  return (
    <span className={`brutal-badge ${map[severity] || map.info}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    filled: "bg-success/15 text-success",
    open: "bg-warning/15 text-warning-foreground",
    cancelled: "bg-secondary text-muted-foreground",
    failed: "bg-destructive/15 text-destructive",
    connected: "bg-success/15 text-success",
    disconnected: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
  };
  return (
    <span className={`brutal-badge ${map[status] || map.open}`}>
      {status}
    </span>
  );
}

export function LogLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    info: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    error: "bg-destructive/15 text-destructive",
    execution: "bg-success/15 text-success",
    sync: "bg-secondary text-muted-foreground",
  };
  return (
    <span className={`brutal-badge ${map[level] || map.info}`}>
      {level}
    </span>
  );
}

// ════════════════════════════════════════════════════
//  GENERIC BADGE
// ════════════════════════════════════════════════════

type BadgeVariant = "default" | "primary" | "success" | "danger" | "warning" | "muted";
const badgeVariantMap: Record<BadgeVariant, string> = {
  default: "bg-card text-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning-foreground",
  muted: "bg-secondary text-muted-foreground",
};

interface BrutalBadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg" | "pill";
  className?: string;
}

export function BrutalBadge({ children, variant = "default", size = "md", className = "" }: BrutalBadgeProps) {
  const sizeClass = size === "sm" ? "brutal-badge-sm" : size === "lg" ? "brutal-badge-lg" : size === "pill" ? "brutal-badge-pill" : "brutal-badge";
  return <span className={`${sizeClass} ${badgeVariantMap[variant]} ${className}`}>{children}</span>;
}

// ════════════════════════════════════════════════════
//  BUTTON
// ════════════════════════════════════════════════════

type BtnVariant = "primary" | "secondary" | "danger" | "success" | "warning" | "ghost" | "outline" | "icon";

interface BrutalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  loading?: boolean;
  children: ReactNode;
}

const btnClassMap: Record<BtnVariant, string> = {
  primary: "brutal-btn-primary",
  secondary: "brutal-btn-secondary",
  danger: "brutal-btn-danger",
  success: "brutal-btn-success",
  warning: "brutal-btn-warning",
  ghost: "brutal-btn-ghost",
  outline: "brutal-btn-outline",
  icon: "brutal-btn-icon",
};

export function BrutalButton({ variant = "primary", loading, children, disabled, className = "", ...rest }: BrutalButtonProps) {
  return (
    <button className={`${btnClassMap[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="w-4 h-4 animate-spin mr-1.5 inline" />}
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════
//  CARD
// ════════════════════════════════════════════════════

interface BrutalCardProps {
  children: ReactNode;
  variant?: "default" | "static" | "purple";
  className?: string;
  onClick?: () => void;
}

export function BrutalCard({ children, variant = "default", className = "", onClick }: BrutalCardProps) {
  const cls = variant === "static" ? "brutal-card-static" : variant === "purple" ? "brutal-card-purple" : "brutal-card";
  return <div className={`${cls} ${className}`} onClick={onClick}>{children}</div>;
}

export function BrutalCardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function BrutalCardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mt-4 pt-3 border-t-[2px] border-foreground/15 ${className}`}>{children}</div>;
}

// ════════════════════════════════════════════════════
//  FORM CONTROLS
// ════════════════════════════════════════════════════

interface BrutalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function BrutalInput({ className = "", error, ...props }: BrutalInputProps) {
  return (
    <div>
      <input className={`brutal-input ${error ? "ring-2 ring-destructive" : ""} ${className}`} {...props} />
      {error && <p className="text-destructive text-xs font-bold mt-1">{error}</p>}
    </div>
  );
}

interface BrutalTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function BrutalTextarea({ className = "", error, ...props }: BrutalTextareaProps) {
  return (
    <div>
      <textarea className={`brutal-textarea ${error ? "ring-2 ring-destructive" : ""} ${className}`} {...props} />
      {error && <p className="text-destructive text-xs font-bold mt-1">{error}</p>}
    </div>
  );
}

interface BrutalSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function BrutalSelect({ options, placeholder, className = "", ...props }: BrutalSelectProps) {
  return (
    <select className={`brutal-select ${className}`} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function BrutalCheckbox({ label, checked, onChange, disabled, id }: {
  label?: string; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; id?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="brutal-checkbox"
        checked={checked}
        onChange={e => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      {label}
    </label>
  );
}

export function BrutalRadio({ label, name, value, checked, onChange, disabled }: {
  label: string; name: string; value: string; checked?: boolean; onChange?: (value: string) => void; disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
      <input
        type="radio"
        className="brutal-radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange?.(value)}
        disabled={disabled}
      />
      {label}
    </label>
  );
}

export function BrutalRadioGroup({ name, options, value, onChange }: {
  name: string; options: { value: string; label: string }[]; value?: string; onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(o => (
        <BrutalRadio key={o.value} name={name} value={o.value} label={o.label} checked={value === o.value} onChange={onChange} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  TOGGLE / SWITCH
// ════════════════════════════════════════════════════

export function BrutalToggle({ checked, onChange, label, disabled }: {
  checked?: boolean; onChange?: (v: boolean) => void; label?: string; disabled?: boolean;
}) {
  return (
    <label className={`brutal-switch-label ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      {label && <span>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        className="brutal-toggle"
        onClick={() => !disabled && onChange?.(!checked)}
        disabled={disabled}
      >
        <span className="brutal-toggle-thumb" />
      </button>
    </label>
  );
}

// ════════════════════════════════════════════════════
//  SLIDER
// ════════════════════════════════════════════════════

export function BrutalSlider({ value = 0, min = 0, max = 100, onChange, label }: {
  value?: number; min?: number; max?: number; onChange?: (v: number) => void; label?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange?.(Math.round(min + ratio * (max - min)));
  }, [min, max, onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    handleMove(e.clientX);
    const onMove = (ev: PointerEvent) => handleMove(ev.clientX);
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <div>
      {label && <BrutalLabel>{label}: <span className="tabular-nums">{value}</span></BrutalLabel>}
      <div ref={trackRef} className="brutal-slider-track relative" onPointerDown={handlePointerDown}>
        <div className="brutal-slider-fill" style={{ width: `${pct}%` }} />
        <div className="brutal-slider-thumb" style={{ left: `calc(${pct}% - 10px)` }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  TABS
// ════════════════════════════════════════════════════

interface BrutalTabsProps {
  tabs: { id: string; label: string; content: ReactNode }[];
  defaultTab?: string;
}

export function BrutalTabs({ tabs, defaultTab }: BrutalTabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);
  const current = tabs.find(t => t.id === active);
  return (
    <div>
      <div className="brutal-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className="brutal-tab"
            data-active={t.id === active ? "true" : undefined}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="brutal-tab-panel">{current?.content}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  ACCORDION
// ════════════════════════════════════════════════════

interface AccordionItem { id: string; title: string; content: ReactNode; }

export function BrutalAccordion({ items, multiple = false }: { items: AccordionItem[]; multiple?: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setOpen(prev => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  return (
    <div className="brutal-accordion">
      {items.map(item => (
        <div key={item.id} className="brutal-accordion-item">
          <button className="brutal-accordion-trigger" onClick={() => toggle(item.id)}>
            <span>{item.title}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${open.has(item.id) ? "rotate-180" : ""}`} />
          </button>
          {open.has(item.id) && <div className="brutal-accordion-content">{item.content}</div>}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  ALERT / BANNER
// ════════════════════════════════════════════════════

type AlertVariant = "info" | "success" | "warning" | "danger";

const alertIcons: Record<AlertVariant, ReactNode> = {
  info: <Info className="w-5 h-5 text-primary flex-shrink-0" />,
  success: <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />,
  danger: <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />,
};

const alertClasses: Record<AlertVariant, string> = {
  info: "brutal-alert-info",
  success: "brutal-alert-success",
  warning: "brutal-alert-warning",
  danger: "brutal-alert-danger",
};

export function BrutalAlert({ variant = "info", title, children, onDismiss }: {
  variant?: AlertVariant; title?: string; children: ReactNode; onDismiss?: () => void;
}) {
  return (
    <div className={alertClasses[variant]}>
      {alertIcons[variant]}
      <div className="flex-1">
        {title && <p className="font-bold text-sm mb-0.5">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  CALLOUT
// ════════════════════════════════════════════════════

export function BrutalCallout({ variant = "info", children, className = "" }: {
  variant?: "info" | "warning" | "danger" | "success"; children: ReactNode; className?: string;
}) {
  const cls = variant === "warning" ? "brutal-callout-warning" : variant === "danger" ? "brutal-callout-danger" : variant === "success" ? "brutal-callout-success" : "brutal-callout-info";
  return <div className={`${cls} ${className}`}>{children}</div>;
}

// ════════════════════════════════════════════════════
//  DIALOG / MODAL
// ════════════════════════════════════════════════════

export function BrutalDialog({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="brutal-overlay" onClick={onClose} />
      <div className="brutal-dialog" role="dialog" aria-modal="true">
        {title && (
          <div className="brutal-dialog-header flex items-center justify-between">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="brutal-dialog-body">{children}</div>
        {footer && <div className="brutal-dialog-footer">{footer}</div>}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════
//  CONFIRM DIALOG
// ════════════════════════════════════════════════════

export function BrutalConfirmDialog({ open, onClose, onConfirm, title = "Confirm", message, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "primary" }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title?: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: "primary" | "danger";
}) {
  return (
    <BrutalDialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <BrutalButton variant="secondary" onClick={onClose}>{cancelLabel}</BrutalButton>
          <BrutalButton variant={variant === "danger" ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</BrutalButton>
        </>
      }
    >
      <p className="text-sm">{message}</p>
    </BrutalDialog>
  );
}

// ════════════════════════════════════════════════════
//  DRAWER (Side / Bottom)
// ════════════════════════════════════════════════════

export function BrutalDrawer({ open, onClose, title, children, side = "right" }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; side?: "right" | "bottom";
}) {
  if (!open) return null;
  const drawerCls = side === "bottom" ? "brutal-drawer" : "brutal-drawer-side";
  return (
    <>
      <div className="brutal-overlay" onClick={onClose} />
      <div className={drawerCls}>
        <div className="p-5 border-b-[2.5px] border-foreground flex items-center justify-between">
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════
//  TOOLTIP
// ════════════════════════════════════════════════════

export function BrutalTooltip({ children, content }: { children: ReactNode; content: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
    setShow(true);
  };

  return (
    <>
      <span ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)} className="inline-flex">
        {children}
      </span>
      {show && (
        <div
          className="brutal-tooltip fixed -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════
//  POPOVER
// ════════════════════════════════════════════════════

export function BrutalPopover({ trigger, children, align = "left" }: {
  trigger: ReactNode; children: ReactNode; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className={`brutal-popover absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  DROPDOWN MENU
// ════════════════════════════════════════════════════

interface DropdownItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export function BrutalDropdownMenu({ trigger, items, label, align = "left" }: {
  trigger: ReactNode; items: (DropdownItem | "separator" | { type: "label"; text: string })[]; label?: string; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className={`brutal-dropdown absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"}`}>
          {label && <div className="brutal-dropdown-label">{label}</div>}
          {items.map((item, i) => {
            if (item === "separator") return <div key={i} className="brutal-dropdown-separator" />;
            if (typeof item === "object" && "type" in item && item.type === "label") return <div key={i} className="brutal-dropdown-label">{item.text}</div>;
            const menuItem = item as DropdownItem;
            return (
              <button
                key={i}
                className="brutal-dropdown-item w-full text-left flex items-center gap-2"
                data-danger={menuItem.danger || undefined}
                disabled={menuItem.disabled}
                onClick={() => { menuItem.onClick?.(); setOpen(false); }}
              >
                {menuItem.icon}
                {menuItem.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  TABLE
// ════════════════════════════════════════════════════

interface BrutalTableProps<T> {
  columns: { key: string; header: string; render?: (item: T) => ReactNode }[];
  data: T[];
  variant?: "default" | "bordered" | "striped";
  onRowClick?: (item: T) => void;
}

export function BrutalTable<T extends Record<string, any>>({ columns, data, variant = "default", onRowClick }: BrutalTableProps<T>) {
  const wrapperCls = variant === "bordered" ? "brutal-table-bordered" : "";
  const tableCls = `brutal-table ${variant === "striped" ? "brutal-table-striped" : ""}`;
  return (
    <div className={wrapperCls}>
      <table className={tableCls}>
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} className={onRowClick ? "cursor-pointer" : ""} onClick={() => onRowClick?.(item)}>
              {columns.map(c => <td key={c.key}>{c.render ? c.render(item) : item[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  PROGRESS
// ════════════════════════════════════════════════════

export function BrutalProgress({ value = 0, max = 100, variant = "primary", striped, label }: {
  value?: number; max?: number; variant?: "primary" | "success" | "danger" | "warning"; striped?: boolean; label?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorMap = { primary: "bg-primary", success: "bg-success", danger: "bg-destructive", warning: "bg-warning" };
  return (
    <div>
      {label && <div className="flex justify-between mb-1"><span className="text-xs font-bold">{label}</span><span className="text-xs font-bold tabular-nums">{Math.round(pct)}%</span></div>}
      <div className={`brutal-progress ${striped ? "brutal-progress-striped" : ""}`}>
        <div className={`brutal-progress-bar ${colorMap[variant]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  SKELETON
// ════════════════════════════════════════════════════

export function BrutalSkeleton({ variant = "rect", width, height, className = "" }: {
  variant?: "rect" | "text" | "circle"; width?: string | number; height?: string | number; className?: string;
}) {
  const cls = variant === "circle" ? "brutal-skeleton-circle" : variant === "text" ? "brutal-skeleton-text" : "brutal-skeleton";
  return <div className={`${cls} ${className}`} style={{ width, height }} />;
}

// ════════════════════════════════════════════════════
//  AVATAR
// ════════════════════════════════════════════════════

export function BrutalAvatar({ src, alt, initials, size = "md", square }: {
  src?: string; alt?: string; initials?: string; size?: "sm" | "md" | "lg"; square?: boolean;
}) {
  const sizeCls = size === "sm" ? "brutal-avatar-sm" : size === "lg" ? "brutal-avatar-lg" : "brutal-avatar-md";
  const baseCls = square ? "brutal-avatar-square" : "brutal-avatar";
  return (
    <div className={`${baseCls} ${sizeCls}`}>
      {src ? <img src={src} alt={alt} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  TAG / CHIP
// ════════════════════════════════════════════════════

export function BrutalTag({ children, onRemove, variant = "default", className = "" }: {
  children: ReactNode; onRemove?: () => void; variant?: BadgeVariant; className?: string;
}) {
  return (
    <span className={`${onRemove ? "brutal-tag-removable" : "brutal-tag"} ${badgeVariantMap[variant]} ${className}`} onClick={onRemove}>
      {children}
      {onRemove && <X className="w-3 h-3" />}
    </span>
  );
}

// ════════════════════════════════════════════════════
//  EMPTY STATE
// ════════════════════════════════════════════════════

export function BrutalEmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="brutal-empty">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h4 className="font-bold text-lg">{title}</h4>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  DIVIDER / SEPARATOR
// ════════════════════════════════════════════════════

export function BrutalDivider({ variant = "default", label }: { variant?: "default" | "light" | "vertical"; label?: string }) {
  if (variant === "vertical") return <div className="brutal-divider-vertical" />;
  if (label) {
    return (
      <div className="flex items-center gap-3 my-4">
        <div className={`flex-1 ${variant === "light" ? "border-t-[1.5px] border-foreground/20" : "border-t-[2.5px] border-foreground"}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex-1 ${variant === "light" ? "border-t-[1.5px] border-foreground/20" : "border-t-[2.5px] border-foreground"}`} />
      </div>
    );
  }
  return <div className={variant === "light" ? "brutal-divider-light" : "brutal-divider"} />;
}

// ════════════════════════════════════════════════════
//  BREADCRUMB
// ════════════════════════════════════════════════════

export function BrutalBreadcrumb({ items }: { items: { label: string; href?: string; onClick?: () => void }[] }) {
  return (
    <nav className="brutal-breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 brutal-breadcrumb-separator" />}
          {i === items.length - 1 ? (
            <span className="brutal-breadcrumb-active">{item.label}</span>
          ) : (
            <span className="brutal-breadcrumb-item" onClick={item.onClick}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ════════════════════════════════════════════════════
//  KBD (Keyboard Shortcut)
// ════════════════════════════════════════════════════

export function BrutalKbd({ children }: { children: ReactNode }) {
  return <kbd className="brutal-kbd">{children}</kbd>;
}

// ════════════════════════════════════════════════════
//  CODE BLOCK
// ════════════════════════════════════════════════════

export function BrutalCode({ children, inline }: { children: ReactNode; inline?: boolean }) {
  if (inline) return <code className="brutal-code-inline">{children}</code>;
  return <pre className="brutal-code"><code>{children}</code></pre>;
}

// ════════════════════════════════════════════════════
//  PAGINATION
// ════════════════════════════════════════════════════

export function BrutalPagination({ current, total, onChange }: {
  current: number; total: number; onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <nav className="brutal-pagination">
      <button className="brutal-pagination-item" disabled={current <= 1} onClick={() => onChange(current - 1)}>←</button>
      {pages.map(p => (
        <button key={p} className="brutal-pagination-item" data-active={p === current ? "true" : undefined} onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
      <button className="brutal-pagination-item" disabled={current >= total} onClick={() => onChange(current + 1)}>→</button>
    </nav>
  );
}

// ════════════════════════════════════════════════════
//  LIST
// ════════════════════════════════════════════════════

export function BrutalList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`brutal-list ${className}`}>{children}</div>;
}

export function BrutalListItem({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <div className={`${onClick ? "brutal-list-item-interactive" : "brutal-list-item"} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  TOOLBAR
// ════════════════════════════════════════════════════

export function BrutalToolbar({ items }: { items: { id: string; label: string; icon?: ReactNode; active?: boolean; onClick?: () => void }[] }) {
  return (
    <div className="brutal-toolbar">
      {items.map(item => (
        <button key={item.id} className="brutal-toolbar-item flex items-center gap-1.5" data-active={item.active ? "true" : undefined} onClick={item.onClick}>
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  STEPS / STEPPER
// ════════════════════════════════════════════════════

export function BrutalStepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={i < currentStep ? "brutal-step-done" : i === currentStep ? "brutal-step-active" : "brutal-step"}>
            {i < currentStep ? "✓" : i + 1}
          </div>
          <span className="ml-2 text-xs font-bold hidden sm:inline">{step}</span>
          {i < steps.length - 1 && <div className="brutal-step-connector mx-3 flex-1" />}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  DOT INDICATOR
// ════════════════════════════════════════════════════

export function BrutalDot({ variant = "default" }: { variant?: "default" | "active" | "success" | "danger" | "warning" }) {
  const cls = variant === "active" ? "brutal-dot-active" : variant === "success" ? "brutal-dot-success" : variant === "danger" ? "brutal-dot-danger" : variant === "warning" ? "brutal-dot-warning" : "brutal-dot";
  return <span className={cls} />;
}

// ════════════════════════════════════════════════════
//  SPINNER
// ════════════════════════════════════════════════════

export function BrutalSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "brutal-spinner-sm" : size === "lg" ? "brutal-spinner-lg" : "brutal-spinner";
  return <div className={cls} />;
}

// ════════════════════════════════════════════════════
//  TOAST (imperative-style, static render)
// ════════════════════════════════════════════════════

export function BrutalToast({ variant = "info", title, message, onClose }: {
  variant?: AlertVariant; title?: string; message: string; onClose?: () => void;
}) {
  return (
    <div className="brutal-toast">
      {alertIcons[variant]}
      <div className="flex-1">
        {title && <p className="font-bold text-sm">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
//  MARQUEE / TICKER
// ════════════════════════════════════════════════════

export function BrutalMarquee({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`brutal-marquee ${className}`}>
      <div className="brutal-marquee-content">
        {children}
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  FIELD GROUP (Label + Input wrapper)
// ════════════════════════════════════════════════════

export function BrutalFieldGroup({ label, required, error, children, hint }: {
  label: string; required?: boolean; error?: string; children: ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <BrutalLabel required={required}>{label}</BrutalLabel>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}
