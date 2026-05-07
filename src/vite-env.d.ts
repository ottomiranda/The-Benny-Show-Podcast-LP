/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YT_API_KEY?: string;
  readonly VITE_YT_CHANNEL_ID?: string;
  readonly VITE_MAILCHIMP_LIST_URL?: string;
  readonly VITE_BRAND_PITCH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
