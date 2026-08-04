'use client';

import { useDiagramStore } from '@/store/diagramStore';
import type { CloudProviderToggle } from '@/lib/cloudIcons/types';

const OPTIONS: { value: CloudProviderToggle; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
];

/**
 * Three-way AWS / Azure / Off segmented control (Rule 4.1). Stays monochrome
 * (Rule 4.2); brand colors only appear on node icons. Always visible — even
 * with zero cloud nodes — because classification is label-based and renders
 * on demand.
 */
export function CloudProviderIconToggle() {
  const cloudProvider = useDiagramStore((s) => s.cloudProvider);
  const setCloudProvider = useDiagramStore((s) => s.setCloudProvider);

  return (
    <div
      className="flex items-center rounded-md border border-border/60 bg-muted/60 p-0.5"
      role="group"
      aria-label="Cloud provider icons"
    >
      {OPTIONS.map((option) => {
        const active = cloudProvider === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setCloudProvider(option.value)}
            aria-pressed={active}
            title={
              option.value === 'off'
                ? 'Off — keep current node icons'
                : `Show ${option.label} service icons`
            }
            className={`cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
