export type ActionMessageKind = "success" | "error";

export function buildActionMessageUrl(path: string, kind: ActionMessageKind, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${kind}=${encodeURIComponent(message)}`;
}
