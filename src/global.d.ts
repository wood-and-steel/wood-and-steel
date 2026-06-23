/* Shim so TS resolves 'react' and 'react/jsx-runtime' when @types resolution fails (e.g. with types array). */
declare module 'react' {
  export default unknown;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useCallback<T extends (...args: unknown[]) => unknown>(fn: T, deps: unknown[]): T;
  export function useRef<T>(initial: T | null): { current: T | null };
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function lazy<T>(factory: () => Promise<{ default: T }>): T;
  export const Suspense: (props: { fallback?: ReactNode; children?: ReactNode }) => ReactNode;
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

/* Shim so TS resolves 'react-dom' and 'react-dom/client' when @types resolution fails (e.g. with types array). */
declare module 'react-dom' {
  import type { ReactNode } from 'react';
  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | null
  ): ReactNode;
}

declare module 'react-dom/client' {
  interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare global {
  const __INCLUDE_SIM__: boolean;

  interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandle {
    readonly name: string;
    getFile(): Promise<File>;
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  }

  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?(options?: {
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }): Promise<FileSystemFileHandle[]>;
  }

  namespace JSX {
    type Element = unknown;
    type ReactNode = unknown;
    interface ElementClass {}
    interface IntrinsicElements {
      [elem: string]: unknown;
    }
  }
}
