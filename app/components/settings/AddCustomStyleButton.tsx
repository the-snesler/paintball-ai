import { Plus } from "lucide-react";
import { useState } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import StyleForm from "./StyleForm";

export default function AddCustomStyleButton() {
  const addCustomStyle = useSettingsStore((s) => s.addCustomStyle);

  const [isAdding, setIsAdding] = useState(false);

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="border-c-border text-text-tertiary hover:border-c-border hover:text-text-secondary flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom style</span>
      </button>
    );
  }

  return (
    <StyleForm
      submitLabel="Add"
      submitIcon={<Plus className="h-4 w-4" />}
      autoFocusName
      onSubmit={({ name, text, referenceImageId }) => {
        addCustomStyle({ name, text, referenceImageId });
        setIsAdding(false);
      }}
      onCancel={() => setIsAdding(false)}
    />
  );
}
