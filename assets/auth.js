import { supabase, showMessage } from './supabase-client.js';

const form = document.querySelector('#login-form');
const message = document.querySelector('#message');

if (form) {
  if (!supabase) showMessage(message, 'Private sign-in is not configured yet. Follow the setup guide.', true);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(message, 'Signing in…');
    const { error } = await supabase.auth.signInWithPassword({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
    });
    if (error) {
      showMessage(message, 'Sign-in failed. Check your email and password.', true);
      button.disabled = false;
      return;
    }
    window.location.assign('../private/');
  });
}
