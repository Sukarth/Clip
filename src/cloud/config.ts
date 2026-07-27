// Public configuration for talking to the Clip cloud (website + Supabase).
// The Supabase URL and anon/publishable key are PUBLIC by design — they ship
// in the website's browser bundle too — so embedding them in the desktop app
// is expected and safe. No secrets here.

const DEFAULT_SITE_URL = 'https://getclip.vercel.app';
const DEFAULT_SUPABASE_URL = 'https://qjnojvmhbpuwcrvphowo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_7k6BpwN212-LLif2HcQPnw_Q-6Qo87k';

function envValue(name: string): string | null {
    const raw = process.env[name];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves the Supabase project to talk to.
 *
 * The URL and the anon key are overridden as a PAIR: a staging URL with the
 * production key (or vice versa) authenticates against the wrong project and
 * fails in confusing ways, so half an override is treated as no override and
 * warned about rather than silently honoured.
 */
function resolveSupabase(): { url: string; anonKey: string } {
    const url = envValue('CLIP_SUPABASE_URL');
    const anonKey = envValue('CLIP_SUPABASE_ANON_KEY');

    if (url && anonKey) {
        console.log(`[cloud] Using Supabase override: ${url}`);
        return { url, anonKey };
    }

    if (url || anonKey) {
        console.warn(
            '[cloud] Ignoring partial Supabase override — CLIP_SUPABASE_URL and '
            + 'CLIP_SUPABASE_ANON_KEY must both be set. Falling back to the default project.'
        );
    }

    return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
}

const supabase = resolveSupabase();

export const CLOUD = {
    // The marketing/site origin that hosts the /desktop sign-in handoff page and
    // serves /api/sync/*. Override with CLIP_SITE_URL to test against a dev site.
    siteUrl: envValue('CLIP_SITE_URL') ?? DEFAULT_SITE_URL,
    // Override both of these together to point a dev build at a staging Supabase
    // project (run supabase/migrations/*.sql there first). Auth, profiles and
    // Pro status all resolve against whichever project is configured here, so
    // this is what separates staging accounts from production ones.
    supabaseUrl: supabase.url,
    supabaseAnonKey: supabase.anonKey,
} as const;
