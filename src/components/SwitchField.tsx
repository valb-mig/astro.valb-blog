import { useState } from "react";
import { Switch } from "@/components/ui/switch";

interface Props {
  hiddenInputId: string;
  initialChecked: boolean;
}

export function SwitchField({ hiddenInputId, initialChecked }: Props) {
  const [checked, setChecked] = useState(initialChecked);

  const commit = (next: boolean) => {
    setChecked(next);
    const hidden = document.getElementById(hiddenInputId) as HTMLInputElement | null;
    if (hidden) {
      hidden.value = String(next);
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return <Switch checked={checked} onCheckedChange={commit} />;
}
