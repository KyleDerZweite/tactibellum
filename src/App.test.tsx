import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import validReplay from "../fixtures/replays/unknown-and-empty.grbr?raw";
import { App } from "./App";
import { useWorkspace } from "./ui/workspace/store";

afterEach(() => {
  cleanup();
  useWorkspace.setState(useWorkspace.getInitialState(), true);
});

function replayFile(name: string, contents = validReplay) {
  const bytes = new TextEncoder().encode(contents);
  const file = new File([contents], name);
  // jsdom implements File but lacks the Blob.arrayBuffer browser API.
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer,
  });
  return file;
}

describe("replay workspace", () => {
  it("parses a local replay and shares the round across enabled views", async () => {
    render(<App />);
    const chooser = screen.getByLabelText<HTMLInputElement>("Replay file", {
      selector: "input",
    });
    expect(chooser.accept).toBe(".grbr");
    const replay = replayFile("rounds.GRBR");
    fireEvent.change(chooser, { target: { files: [replay] } });
    await screen.findByRole("heading", { name: "Overview" });
    expect(
      within(screen.getByRole("banner")).getByText(/rounds\.GRBR · Patch 959/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Action Log" }));
    expect(screen.getByText("PAD_Experimental")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Round" }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Raw JSON" }));
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Pull request template").value,
    ).toContain("tech: 9999");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Show source records" }),
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Source records JSON").value,
    ).toContain("original test payload");
    fireEvent.click(screen.getByRole("link", { name: "Action Log" }));
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Round" }).value,
    ).toBe("2");
  });

  it("keeps the last match after invalid inputs and can open the demo", async () => {
    render(<App />);
    const dropArea = screen.getByRole("heading", { name: /drop a/i });
    const first = replayFile("first.grbr");
    fireEvent.drop(dropArea, { dataTransfer: { files: [first] } });
    await screen.findByRole("heading", { name: "Overview" });
    fireEvent.drop(dropArea, {
      dataTransfer: { files: [new File([], "notes.txt")] },
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose one .grbr replay file.",
    );
    fireEvent.drop(dropArea, { dataTransfer: { files: [first, first] } });
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose one .grbr replay file.",
    );
    fireEvent.drop(dropArea, {
      dataTransfer: { files: [replayFile("malformed.grbr", "<oops>")] },
    });
    await screen.findByText(/Malformed replay XML/);
    expect(useWorkspace.getState().match?.meta.fileName).toBe("first.grbr");

    fireEvent.click(screen.getByRole("button", { name: "Try demo match" }));
    await screen.findByRole("heading", { name: "Tactical Board" });
    fireEvent.click(screen.getByRole("link", { name: "Change replay" }));
    expect(screen.getByText("flank-pressure.grbr loaded.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(useWorkspace.getState().match?.rounds).toHaveLength(9);
    expect(useWorkspace.getState().selectedRound).toBe(1);
  });
});
