import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WinnerControl } from "../workspace/WinnerControl";
import { RuleFindings } from "../findings/RuleFindings";
import { match, report } from "./analysisFixture.test-data";
import { analysisFormulas } from "../../core/analytics/formulas";
import { ruleSupportNote } from "../../core/analytics/rounds";
import { AnalysisCharts } from "./AnalysisCharts";

afterEach(cleanup);

it("shows the recorded winner and emits a player ID or null", () => {
  const onWinnerChange = vi.fn();
  render(<WinnerControl meta={match.meta} onWinnerChange={onWinnerChange} />);

  const winner = screen.getByRole<HTMLSelectElement>("combobox", {
    name: "Winner",
  });
  expect(winner.value).toBe("p1");
  fireEvent.change(winner, { target: { value: "p2" } });
  expect(onWinnerChange).toHaveBeenLastCalledWith("p2");
  fireEvent.change(winner, { target: { value: "" } });
  expect(onWinnerChange).toHaveBeenLastCalledWith(null);
});

it("follows the board round and combines finding filters before sending the original highlight", () => {
  const onGoToFinding = vi.fn();
  const { rerender } = render(
    <RuleFindings
      match={match}
      report={report}
      selectedRound={2}
      onGoToFinding={onGoToFinding}
    />,
  );

  expect(screen.getByRole("heading", { name: "Anti-air gap" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Low chaff share" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Round"), { target: { value: "" } });
  expect(screen.getAllByRole("button", { name: /Show on board/ })).toHaveLength(
    2,
  );

  fireEvent.change(screen.getByLabelText("Player"), {
    target: { value: "p2" },
  });
  fireEvent.change(screen.getByLabelText("Severity"), {
    target: { value: "critical" },
  });
  expect(screen.getByText("No findings match these filters.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Severity"), {
    target: { value: "warning" },
  });
  fireEvent.change(screen.getByLabelText("Rule"), {
    target: { value: "anti-air-gap" },
  });
  expect(screen.getByText("No findings match these filters.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Rule"), {
    target: { value: "chaff-ratio" },
  });
  expect(screen.getByText("Chaff share < 15%")).toBeTruthy();
  expect(screen.getByText("0.1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Show on board/ }));
  expect(onGoToFinding).toHaveBeenCalledWith(report.findings[1]);

  rerender(
    <RuleFindings
      match={match}
      report={report}
      selectedRound={8}
      onGoToFinding={onGoToFinding}
    />,
  );
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Round" }).value,
  ).toBe("8");
});

it("explains when the rule engine does not support the replay mode", () => {
  render(
    <RuleFindings
      match={{ ...match, meta: { ...match.meta, mode: "2v2" } }}
      report={{ ...report, findings: [] }}
      selectedRound={2}
      onGoToFinding={vi.fn()}
    />,
  );
  expect(screen.getByText(ruleSupportNote)).toBeTruthy();
  expect(screen.queryByText("No findings match these filters.")).toBeNull();
});

it("uses replay round numbers and exposes missing data through the keyboard-accessible chart table", () => {
  const onGoToRound = vi.fn();
  const props = { match, report, onGoToRound };
  const { rerender } = render(<AnalysisCharts {...props} selectedRound={2} />);

  fireEvent.click(screen.getByText("Round data"));
  const round = screen.getByRole("button", { name: "Round 8" });
  round.focus();
  expect(document.activeElement).toBe(round);
  fireEvent.click(round, { detail: 0 });
  expect(onGoToRound).toHaveBeenCalledWith(8);
  expect(screen.queryByRole("button", { name: "Round 3" })).toBeNull();

  rerender(<AnalysisCharts {...props} selectedRound={8} />);
  expect(round.getAttribute("aria-current")).toBe("true");

  fireEvent.change(screen.getByRole("combobox", { name: "Metric" }), {
    target: { value: "armyValueDelta" },
  });
  fireEvent.click(screen.getByText("Formula for Army value change"));
  expect(screen.getByText(analysisFormulas.armyValueDelta)).toBeTruthy();
  const rows = screen.getAllByRole("row");
  expect(rows[1].textContent).toBe("Round 2UnavailableUnavailable");
  expect(rows[2].textContent).toBe("Round 5UnavailableUnavailable");
  expect(rows[3].textContent).toBe("Round 8360Unavailable");
});
