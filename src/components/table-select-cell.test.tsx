import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TableSelectCell } from "@/components/table-select-cell";

describe("TableSelectCell", () => {
  it("toggles selection when the padded cell is clicked and does not trigger row navigation", () => {
    const openRow = vi.fn();
    render(
      <table>
        <tbody>
          <tr onClick={openRow}>
            <td>
              <TableSelectCell aria-label="Select complaint R-1" />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select complaint R-1" });
    const cell = checkbox.closest("label");
    expect(cell).not.toBeNull();

    // Tap beside the visible box, on the padded hit area.
    fireEvent.click(cell!);
    expect(checkbox).toHaveAttribute("data-state", "checked");
    expect(openRow).not.toHaveBeenCalled();

    // Tapping the box itself also toggles without opening the row.
    fireEvent.click(checkbox);
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
    expect(openRow).not.toHaveBeenCalled();
  });

  it("keeps the visible box 16px with a larger padded hit area", () => {
    render(<TableSelectCell aria-label="Select complaint R-2" />);
    const checkbox = screen.getByRole("checkbox", { name: "Select complaint R-2" });
    expect(checkbox.className).toContain("h-4");
    expect(checkbox.className).toContain("w-4");
    const cell = checkbox.closest("label");
    expect(cell?.className).toContain("p-3");
    expect(cell?.className).toContain("md:p-1");
  });
});
