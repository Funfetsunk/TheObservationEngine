export function logStructured(obj: Record<string, unknown>): void {
  console.log(JSON.stringify(obj));
}

export function logError(obj: Record<string, unknown>): void {
  console.error(JSON.stringify(obj));
}
