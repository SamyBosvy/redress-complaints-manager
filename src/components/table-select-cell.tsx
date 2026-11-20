import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";

// Selection checkbox for clickable table rows: the visible box stays 16px, but the
// label padding gives a >=24x24 hit area on desktop and >=44x44 below md. The label
// toggles the checkbox when its padding is tapped, and stopPropagation keeps the tap
// from opening the row.
export function TableSelectCell(props: React.ComponentProps<typeof Checkbox>) {
  return (
    <label
      className="inline-flex cursor-pointer items-center justify-center p-3 md:p-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox {...props} />
    </label>
  );
}
