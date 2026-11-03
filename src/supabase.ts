// The site's Supabase project. The publishable key can only call the public sign-up and
// page-view functions; none of the stored data can be read with it.
export const supabaseUrl = "https://zmwcglopxlsbewvegoyw.supabase.co";
export const supabasePublishableKey = "sb_publishable_S21fJaJ1EVKxDJp6V65oIA_C3zEQFNP";

export const rpcUrl = (name: string) => `${supabaseUrl}/rest/v1/rpc/${name}`;
