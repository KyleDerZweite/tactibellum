import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("replay workspace", () => {
  it("accepts a local replay from the chooser and displays the file name", () => {
    render(<App />);
    const chooser = screen.getByLabelText<HTMLInputElement>("Replay file", {
      selector: "input",
    });
    expect(chooser.accept).toBe(".grbr");
    const replay = new File(["replay"], "rounds.GRBR");

    fireEvent.change(chooser, { target: { files: [replay] } });

    expect(
      within(screen.getByRole("banner")).getByText(replay.name),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      `${replay.name} selected`,
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Demo coming soon",
      }).disabled,
    ).toBe(true);
  });

  it("rejects unsupported and multiple drops before allowing a valid replacement", () => {
    render(<App />);
    const dropArea = screen.getByRole("heading", { name: /drop a/i });
    const first = new File(["replay"], "first.grbr");
    const second = new File(["replay"], "second.grbr");

    fireEvent.drop(dropArea, { dataTransfer: { files: [first] } });
    fireEvent.drop(dropArea, {
      dataTransfer: { files: [new File([], "notes.txt")] },
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose one .grbr replay file.",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "first.grbr selected",
    );

    fireEvent.drop(dropArea, { dataTransfer: { files: [first, second] } });
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose one .grbr replay file.",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "first.grbr selected",
    );

    fireEvent.drop(dropArea, { dataTransfer: { files: [second] } });
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(screen.getByRole("status").textContent).toContain(
      "second.grbr selected",
    );
  });
});
