export function safeStringify(value: unknown, space: number | string = 2): string {
  const seen = new WeakSet<object>();

  const replacer = (_key: string, v: unknown) => {
    if (typeof v === 'bigint') return v.toString();

    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[Circular]';
      seen.add(v as object);

      if (v instanceof Map) return Object.fromEntries(v.entries());
      if (v instanceof Set) return Array.from(v.values());
    }

    if (typeof v === 'function') return `[Function ${(v as Function).name || 'anonymous'}]`;
    if (typeof v === 'symbol') return (v as symbol).toString();

    return v;
  };

  try {
    return JSON.stringify(value, replacer, space);
  } catch {
    try {
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  }
}
