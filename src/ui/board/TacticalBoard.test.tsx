import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import demo from "../../../fixtures/replays/flank-pressure.grbr?raw";
import unknown from "../../../fixtures/replays/unknown-and-empty.grbr?raw";
import { parseRawReplay } from "../../core/parser";
import { reconstructMatch } from "../../core/state";
import { patchFor } from "../workspace/patches";
import { useWorkspace } from "../workspace/store";
import { App } from "../../App";
import { TacticalBoard } from "./TacticalBoard";

afterEach(() => {
  cleanup();
  useWorkspace.setState(useWorkspace.getInitialState(), true);
});

function open(source = demo) {
  const raw = parseRawReplay(source);
  const patch = patchFor(raw.version);
  const match = reconstructMatch(raw, patch);
  useWorkspace.getState().openMatch(match, raw, patch, "board");
}

function choose(name: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name }), {
    target: { value },
  });
}

it("navigates all demo rounds by arrow key and shares round jumps with other views", () => {
  open();
  render(<App />);
  for (let round = 2; round <= 9; round++) {
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("button", { name: `Round ${round}` })
        .getAttribute("aria-current"),
    ).toBe("step");
  }
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Next round" })
      .disabled,
  ).toBe(true);
  fireEvent.keyDown(document.body, { key: "ArrowLeft" });
  expect(useWorkspace.getState().selectedRound).toBe(8);
  fireEvent.click(screen.getByRole("button", { name: "Round 3" }));
  fireEvent.click(screen.getByRole("link", { name: "Action Log" }));
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Round" }).value,
  ).toBe("3");
  choose("Round", "7");
  fireEvent.click(screen.getByRole("link", { name: "Tactical Board" }));
  expect(screen.getByRole("heading", { name: "Round 7" })).toBeTruthy();
});

it("places positive-first at the bottom and flips the calibrated field and highlight together", () => {
  open();
  useWorkspace.getState().selectRound(5);
  const { container } = render(
    <TacticalBoard
      highlight={{
        units: [{ playerId: "2", instanceId: "5" }],
        region: { x: 300, y: 10, width: 60, height: 300 },
      }}
    />,
  );
  const token = screen.getByRole("button", { name: /Overlord #5/ });
  const phoenix = screen.getByRole("button", { name: /Phoenix #6/ });
  const region = container.querySelector(".board-region");
  expect(token.getAttribute("data-highlighted")).toBe("true");
  expect(phoenix.getAttribute("transform")).toBe("translate(-324 215)");
  expect(token.getAttribute("transform")).toBe("translate(-330 120)");
  expect(region?.getAttribute("x")).toBe("-360");
  expect(region?.getAttribute("y")).toBe("10");
  expect(container.querySelectorAll(".board-flank")).toHaveLength(4);
  expect(container.querySelectorAll(".board-tower")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "Tower defense" }));
  expect(
    [...container.querySelectorAll(".board-defense")].map((node) =>
      node.getAttribute("r"),
    ),
  ).toEqual(["100", "100", "100", "100"]);
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  expect(token.getAttribute("transform")).toBe("translate(330 -120)");
  expect(region?.getAttribute("x")).toBe("300");
  expect(region?.getAttribute("y")).toBe("-310");
});

it("opens the inspector from a unit, draws unit and role ranges, and reveals removed units on demand", () => {
  open();
  useWorkspace.getState().selectRound(4);
  const { container } = render(<TacticalBoard />);
  const token = screen.getByRole("button", { name: /Overlord #5/ });
  fireEvent.keyDown(token, { key: "Enter" });
  expect(screen.getByRole("heading", { name: "Overlord" })).toBeTruthy();
  choose("Range", "selected");
  const circles = () => [...container.querySelectorAll(".board-range")];
  expect(circles().map((circle) => circle.getAttribute("cx"))).toEqual([
    "-330",
  ]);
  expect(circles()[0].getAttribute("r")).toBe("120");
  choose("Role", "air");
  expect(
    container.querySelector(".board-unit[data-dimmed='true']"),
  ).toBeTruthy();
  choose("Range", "anti-air");
  expect(circles().length).toBeGreaterThan(1);
  const canvas = screen.getByRole("group", { name: "Deployment board" });
  fireEvent.click(screen.getByRole("button", { name: "Round 3" }));
  expect(within(canvas).queryByRole("button", { name: /removed/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Diff" }));
  const removed = within(canvas).getByRole("button", { name: /removed/ });
  expect(removed.getAttribute("data-diff")).toBe("removed");
  fireEvent.click(removed);
  expect(
    within(
      screen.getByRole("complementary", { name: "Round and unit inspector" }),
    ).getByText("Removed"),
  ).toBeTruthy();
});

it("allows unplaced records to be inspected without drawing them at the origin", () => {
  open(unknown);
  useWorkspace.getState().selectRound(2);
  const { container } = render(<TacticalBoard />);
  const picker = screen.getByRole<HTMLSelectElement>("combobox", {
    name: "Unit",
  });
  const unplaced = [...picker.options].find((option) =>
    option.textContent?.includes("Position unavailable"),
  );
  expect(unplaced).toBeTruthy();
  choose("Unit", unplaced!.value);
  expect(screen.getByText(/no recorded position/)).toBeTruthy();
  expect(
    container.querySelector(".board-unit[aria-pressed='true']"),
  ).toBeNull();
});

it("keeps active role and range filters visible across rounds without that role", () => {
  open();
  useWorkspace.getState().selectRound(2);
  render(<TacticalBoard />);
  choose("Role", "siege");
  choose("Range", "siege");
  fireEvent.click(screen.getByRole("button", { name: "Round 1" }));
  for (const name of ["Role", "Range"]) {
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name }).value,
    ).toBe("siege");
  }
});

it("removes clipped zoomed units from tab order while retaining the inspector picker", () => {
  open();
  useWorkspace.getState().selectRound(5);
  render(<TacticalBoard />);
  const token = screen.getByRole("button", { name: /Overlord #5/ });
  expect(token.getAttribute("tabindex")).toBe("0");
  for (let step = 0; step < 5; step++) {
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  }
  expect(token.getAttribute("tabindex")).toBe("-1");
  const option = screen.getByRole<HTMLOptionElement>("option", {
    name: /Overlord #5/,
  });
  choose("Unit", option.value);
  expect(screen.getByRole("heading", { name: "Overlord" })).toBeTruthy();
});
