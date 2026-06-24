// Declare Vite ?raw module imports so TypeScript doesn't report missing module errors
declare module "*?raw" {
  const content: string;
  export default content;
}

// Declare Cloudflare Workers test modules to satisfy TypeScript compilation in tests
declare module "cloudflare:test" {
  export const env: any;
  export function createExecutionContext(): any;
  export function waitOn(promise: Promise<any>): void;
}

declare module "cloudflare:workers" {
  export const env: any;
}
