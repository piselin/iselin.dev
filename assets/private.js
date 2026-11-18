import { supabase, ownerSession, showMessage } from './supabase-client.js';

const page = document.body.dataset.page;
const content = document.querySelector('#private-content');
const message = document.querySelector('#message');
const signOut = document.querySelector('#sign-out');

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function formField(labelText, name, multiline = false) {
  const label = node('label', labelText);
  const input = node(multiline ? 'textarea' : 'input');
  input.name = name;
  input.required = true;
  if (!multiline) input.maxLength = name === 'title' ? 160 : 240;
  else input.maxLength = 20000;
  label.append(input);
  return { label, input };
}

async function loadDashboard() {
  const [{ count: notesCount, error: notesError }, { count: filesCount, error: filesError }] = await Promise.all([
    supabase.from('notes').select('id', { count: 'exact', head: true }),
    supabase.from('private_files').select('id', { count: 'exact', head: true }),
  ]);
  if (notesError || filesError) throw notesError || filesError;
  const grid = node('div', undefined, 'grid');
  for (const [title, count, href, label] of [
    ['Journal & notes', notesCount, 'notes/', 'Open notes →'],
    ['Documents', filesCount, 'files/', 'Open files →'],
  ]) {
    const card = node('article', undefined, 'card');
    card.append(node('p', title, 'eyebrow'), node('div', String(count || 0), 'stat'));
    const link = node('a', label);
    link.href = href;
    card.append(link);
    grid.append(card);
  }
  const tools = node('article', undefined, 'card');
  tools.append(node('p', 'Personal tools', 'eyebrow'), node('h2', 'Workspace'), node('p', 'A home for small dashboards and tools you choose to add.', 'quiet'));
  grid.append(tools);
  content.replaceChildren(grid);
}

async function loadNotes() {
  const { data: notes, error } = await supabase.from('notes').select('id,title,body,created_at').order('created_at', { ascending: false });
  if (error) throw error;

  const form = node('form', undefined, 'panel form-stack');
  const title = formField('Title', 'title');
  const body = formField('Entry', 'body', true);
  const submit = node('button', 'Save privately');
  submit.type = 'submit';
  form.append(title.label, body.label, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    const { error: saveError } = await supabase.from('notes').insert({
      title: title.input.value.trim(),
      body: body.input.value.trim(),
    });
    if (saveError) {
      showMessage(message, 'The note could not be saved. Please try again.', true);
      submit.disabled = false;
      return;
    }
    await loadNotes();
    showMessage(message, 'Saved privately.');
  });

  const list = node('div', undefined, 'post-list');
  for (const note of notes || []) {
    const card = node('article', undefined, 'card');
    card.append(node('p', new Date(note.created_at).toLocaleDateString(), 'date'), node('h2', note.title), node('div', note.body, 'prose'));
    const remove = node('button', 'Delete entry');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this note permanently?')) return;
      const { error: deleteError } = await supabase.from('notes').delete().eq('id', note.id);
      if (deleteError) {
        showMessage(message, 'The note could not be deleted. Please try again.', true);
        return;
      }
      await loadNotes();
      showMessage(message, 'Note deleted.');
    });
    card.append(remove);
    list.append(card);
  }
  if (!notes?.length) list.append(node('div', 'Your private entries will appear here.', 'panel empty-state'));
  content.replaceChildren(form, list);
}

async function loadFiles() {
  const { data: files, error } = await supabase.from('private_files').select('id,storage_path,original_name,size_bytes,created_at').order('created_at', { ascending: false });
  if (error) throw error;

  const form = node('form', undefined, 'panel form-stack');
  const label = node('label', 'Choose a document');
  const input = node('input');
  input.type = 'file';
  input.required = true;
  label.append(input);
  const hint = node('p', 'Files are private and limited to 10 MB each.', 'quiet');
  const submit = node('button', 'Upload privately');
  submit.type = 'submit';
  form.append(label, hint, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = input.files[0];
    if (!file || file.size < 1 || file.size > 10 * 1024 * 1024) {
      showMessage(message, 'Choose a non-empty file under 10 MB.', true);
      return;
    }
    submit.disabled = true;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      showMessage(message, 'Your sign-in expired. Please sign in again.', true);
      return;
    }
    const safeName = file.name.replace(/[\\/]/g, '_').slice(-180) || 'document';
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('private-documents').upload(storagePath, file, {
      cacheControl: '0',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (uploadError) {
      showMessage(message, 'The file could not be uploaded. Please try again.', true);
      submit.disabled = false;
      return;
    }
    const { error: saveError } = await supabase.from('private_files').insert({
      storage_path: storagePath,
      original_name: file.name.slice(0, 240) || 'document',
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    });
    if (saveError) {
      await supabase.storage.from('private-documents').remove([storagePath]);
      showMessage(message, 'The file was uploaded but its private record could not be saved.', true);
      submit.disabled = false;
      return;
    }
    await loadFiles();
    showMessage(message, 'File uploaded privately.');
  });

  const list = node('div', undefined, 'panel');
  for (const file of files || []) {
    const row = node('div', undefined, 'file-row');
    const details = node('div', undefined, 'file-name');
    details.append(node('strong', file.original_name), node('br'), node('span', `${(file.size_bytes / 1024).toFixed(1)} KB · ${new Date(file.created_at).toLocaleDateString()}`, 'quiet'));
    const actions = node('div', ' ');
    const download = node('button', 'Download');
    download.type = 'button';
    download.addEventListener('click', async () => {
      download.disabled = true;
      const { data, error: downloadError } = await supabase.storage.from('private-documents').download(file.storage_path);
      if (downloadError) {
        showMessage(message, 'The file could not be downloaded.', true);
        download.disabled = false;
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(data);
      link.download = file.original_name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      download.disabled = false;
    });
    const remove = node('button', 'Delete');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this file permanently?')) return;
      const { error: removeError } = await supabase.storage.from('private-documents').remove([file.storage_path]);
      if (removeError) {
        showMessage(message, 'The file could not be deleted.', true);
        return;
      }
      const { error: recordError } = await supabase.from('private_files').delete().eq('id', file.id);
      if (recordError) {
        showMessage(message, 'The file was removed, but its list entry could not be deleted.', true);
        return;
      }
      await loadFiles();
      showMessage(message, 'File deleted.');
    });
    actions.append(download, remove);
    row.append(details, actions);
    list.append(row);
  }
  if (!files?.length) list.append(node('p', 'No documents uploaded yet.', 'empty-state'));
  content.replaceChildren(form, list);
}

if (signOut && supabase) {
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage(message, 'Could not sign out. Please try again.', true);
      signOut.disabled = false;
      return;
    }
    window.location.assign('../');
  });
} else if (signOut) {
  signOut.hidden = true;
}

if (content) {
  const { error } = await ownerSession();
  if (error) {
    showMessage(message, error.message, true);
    if (error.message === 'Please sign in to continue.') {
      window.location.replace('../login/');
    } else {
      content.hidden = true;
    }
  } else {
    try {
      if (page === 'dashboard') await loadDashboard();
      else if (page === 'notes') await loadNotes();
      else if (page === 'files') await loadFiles();
    } catch (error) {
      showMessage(message, 'The private content could not be loaded. Check the Supabase setup and try again.', true);
      console.error(error);
    }
  }
}
