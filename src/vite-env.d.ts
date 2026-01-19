/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_LEMONSQUEEZY_CHECKOUT_URL?: string;
  readonly VITE_LEMONSQUEEZY_PORTAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


