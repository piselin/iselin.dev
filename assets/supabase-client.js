import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm';

const config = window.SUPABASE_CONFIG;
const configured = config?.url?.startsWith('https://')
  && !config.url.includes('YOUR_PROJECT_ID')
  && config.anonKey
  && !config.anonKey.includes('YOUR_SUPABASE');

export const supabase = configured
  ? createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  })
  : null;

export function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('danger', isError);
}

export async function ownerSession() {
  if (!supabase) return { error: new Error('Private sign-in is not configured yet. Follow the setup guide.') };
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return { error: error || new Error('Please sign in to continue.') };
  const { data: isOwner, error: ownerError } = await supabase.rpc('is_site_owner');
  if (ownerError || !isOwner) {
    await supabase.auth.signOut();
    return { error: ownerError || new Error('This account is not authorized for the private area.') };
  }
  return { session };
}
