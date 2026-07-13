import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Clock3, Info, PackageCheck, ShieldCheck } from "lucide-react";

type GuideTone = "info" | "success" | "attention";

type GuideItem = {
  title: string;
  description: React.ReactNode;
  icon?: LucideIcon;
  tone?: GuideTone;
};

const defaultIcons: Record<GuideTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  attention: AlertCircle
};

export const guideIcons = { Clock3, PackageCheck, ShieldCheck };

export function OperationGuide({ items }: { items: GuideItem[] }) {
  return (
    <div className="operation-guide">
      {items.map(({ title, description, icon, tone = "info" }) => {
        const Icon = icon ?? defaultIcons[tone];

        return (
          <div className={`operation-guide-item ${tone}`} key={title}>
            <span className="operation-guide-icon" aria-hidden="true"><Icon size={17} strokeWidth={2.25} /></span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
