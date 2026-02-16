/* Shim so TS resolves 'react' and 'react/jsx-runtime' when @types resolution fails (e.g. with types array). */
declare module 'react' {
  export default unknown;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useCallback<T extends (...args: unknown[]) => unknown>(fn: T, deps: unknown[]): T;
  export function useRef<T>(initial: T | null): { current: T | null };
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export namespace React {
    type FormEvent<T> = unknown;
    type ReactNode = unknown;
  }
  export type ReactNode = any;
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown;
  export const jsxDEV: unknown;
  export const Fragment: unknown;
}

declare global {
  namespace JSX {
    type Element = unknown;
    type ReactNode = unknown;
    interface ElementClass {}
    interface IntrinsicElements {
      [elem: string]: unknown;
    }
  }
}
