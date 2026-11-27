const icons = {
  diff: "M3 5h8v8H3z M9 9h8v8H9z",
  flank: "M2 4h16v12H2z M6 4v12 M14 4v12",
  tower: "M6 3v4h8V3 M4 3v6l3 2v6h6v-6l3-2V3 M5 17h10",
  flip: "M2 6h15m-3-3 3 3-3 3 M18 14H3m3-3-3 3 3 3",
  reset: "M4 9a6 6 0 1 1 1 5 M4 3v6h6",
};

export function BoardControlIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      aria-hidden="true"
      className="board-control-icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={icons[name]} />
    </svg>
  );
}
