import { MessageSquareText } from "lucide-react";
import { hasProviderAccess } from "~/lib/providers";
import { useSettingsStore } from "~/stores/settingsStore";
import { Switch } from "~/components/ui/Switch";
import AddCustomTextModelButton from "./AddCustomTextModelButton";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import TextModelItem from "./TextModelItem";

export function TextModelsSection() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const textModels = useSettingsStore((s) => s.textModels);
  const alwaysImprovePromptEnabled = useSettingsStore((s) => s.alwaysImprovePromptEnabled);
  const setAlwaysImprovePromptEnabled = useSettingsStore((s) => s.setAlwaysImprovePromptEnabled);

  return (
    <section id="text-models" className="group space-y-3">
      <SettingsSectionHeader
        icon={MessageSquareText}
        title="Text models"
        subtitle="Manage your text models. Text models are used to rewrite prompts and integrate character and style information into the prompt."
      />

      <div className="space-y-3 pl-6">
        <div className="space-y-1">
          {textModels.map((model) => (
            <TextModelItem
              key={model.id}
              model={model}
              hasApiKey={hasProviderAccess(apiKeys, model.provider)}
            />
          ))}
        </div>
        <AddCustomTextModelButton />

        <div className="border-border-subtle bg-surface-raised/60 space-y-3 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-text-secondary text-sm">Always rewrite prompt</span>
            <Switch
              checked={alwaysImprovePromptEnabled}
              onChange={(event) => setAlwaysImprovePromptEnabled(event.target.checked)}
              aria-label="Toggle always rewrite prompt"
            />
          </label>
          <p className="text-text-muted text-xs">
            Silently pass every prompt through a text model before generation. Has the same effect
            as the "rewrite" button in input areas (and, if that button is used, this step is
            skipped). Your original prompt is preserved and shown as the primary prompt in the
            lightbox.
          </p>
        </div>
      </div>
    </section>
  );
}
