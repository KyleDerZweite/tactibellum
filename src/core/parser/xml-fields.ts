type XmlValue = string | XmlNode | XmlValue[];
export interface XmlNode {
  [key: string]: XmlValue | undefined;
}

export function node(value: unknown): XmlNode {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlNode)
    : {};
}

export function list(value: XmlValue | undefined): XmlValue[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function children(parent: XmlValue | undefined, tag: string) {
  return list(node(parent)[tag]).map(node);
}

export function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function number(value: unknown): number | undefined {
  const text = string(value);
  if (text === undefined) return;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function index(value: unknown): number | undefined {
  const parsed = number(value);
  return parsed !== undefined && Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

export function position(value: unknown) {
  const { x, y } = node(value);
  const px = number(x);
  const py = number(y);
  if (px !== undefined && py !== undefined) return { x: px, y: py };
}

export function orientation(value: unknown) {
  if (value === "true") return 90;
  if (value === "false") return 0;
}
