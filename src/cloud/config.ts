// Public configuration for talking to the Clip cloud (website + Supabase).
// The Supabase URL and anon/publishable key are PUBLIC by design — they ship
// in the website's browser bundle too — so embedding them in the desktop app
// is expected and safe. No secrets here.

export const CLOUD = {
    // The marketing/site origin that hosts the /desktop sign-in handoff page.
    // Override with CLIP_SITE_URL for local testing against the dev site.
    siteUrl: process.env.CLIP_SITE_URL || 'https://getclip.vercel.app',
    supabaseUrl: 'https://qjnojvmhbpuwcrvphowo.supabase.co',
    supabaseAnonKey: 'sb_publishable_7k6BpwN212-LLif2HcQPnw_Q-6Qo87k',
} as const;
