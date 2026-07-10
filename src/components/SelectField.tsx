import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { value: string; label: string };

interface Props {
  hiddenInputId: string;
  initialValue: string;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function SelectField({ hiddenInputId, initialValue, options, placeholder, className }: Props) {
  const [value, setValue] = useState(initialValue);

  const commit = (next: string) => {
    setValue(next);
    const hidden = document.getElementById(hiddenInputId) as HTMLInputElement | null;
    if (hidden) {
      hidden.value = next;
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <Select value={value} onValueChange={commit}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
