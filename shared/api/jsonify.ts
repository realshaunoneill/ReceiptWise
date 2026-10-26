/**
 * A server type as it arrives over JSON: dates become ISO strings, and everything else keeps its
 * shape. lib/types/wire-contract.ts uses it to check, at compile time, that what each route
 * returns still matches the wire types the app reads (shared/api/*).
 */
export type Jsonify<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;
