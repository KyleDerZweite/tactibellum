export const roleNames: Record<string, string> = {
  air: "Air",
  "anti-air": "Anti-air",
  chaff: "Chaff",
  "chaff-clear": "Chaff clear",
  giant: "Giant",
  "single-target": "Single target",
};

export function RangeControl({
  range,
  roles,
  onChange,
}: {
  range: string;
  roles: string[];
  onChange: (range: string) => void;
}) {
  return (
    <label>
      Range{" "}
      <select
        value={range}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Off</option>
        <option value="selected">Selected unit</option>
        <option value="all">All units</option>
        {roles
          .filter((role) => role !== "all")
          .map((role) => (
            <option key={role} value={role}>
              {roleNames[role] ?? role}
            </option>
          ))}
      </select>
    </label>
  );
}
