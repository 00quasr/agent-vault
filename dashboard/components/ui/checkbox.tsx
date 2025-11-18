import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    const id = React.useId();
    const checkboxId = props.id || id;

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="checkbox"
            ref={ref}
            id={checkboxId}
            className="peer h-4 w-4 shrink-0 rounded border border-gray-300 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:bg-gray-900 checked:border-gray-900"
            {...props}
          />
          <Check className="absolute left-0 top-0 h-4 w-4 text-white pointer-events-none hidden peer-checked:block" strokeWidth={3} />
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-sm text-gray-900 cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
