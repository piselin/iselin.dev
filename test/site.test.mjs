import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('static public and private routes exist without private content', async () => {
  for (const file of [
    'index.html',
    'blog/index.html',
    'login/index.html',
    'private/index.html',
    'private/notes/index.html',
    'private/files/index.html',
  ]) {
    assert.match(await read(file), /<main>/, `${file} should be a static page`);
  }
  const posts = JSON.parse(await read('content/posts.json'));
  assert.deepEqual(posts, [], 'the public blog must not contain invented posts');

  for (const file of ['private/index.html', 'private/notes/index.html', 'private/files/index.html']) {
    const html = await read(file);
    assert.match(html, /private\.js/);
    assert.doesNotMatch(html, /sample private|private document contents/i);
  }
});

test('local asset and navigation URLs work at the apex and project Pages path', async () => {
  const pages = [
    'index.html',
    'blog/index.html',
    'login/index.html',
    'private/index.html',
    'private/notes/index.html',
    'private/files/index.html',
  ];
  for (const file of pages) {
    const html = await read(file);
    const pageDirectory = path.posix.dirname(file);
    const pagePath = pageDirectory === '.' ? '' : `${pageDirectory}/`;
    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    for (const basePath of ['/', '/iselin.dev/']) {
      for (const reference of references) {
        if (/^(?:https?:|data:|#)/i.test(reference)) continue;
        assert.ok(!reference.startsWith('/'), `${file} should use a relative URL: ${reference}`);
        const resolved = new URL(reference, `https://pages.example${basePath}${pagePath}`);
        assert.ok(resolved.pathname.startsWith(basePath), `${reference} escaped the site base ${basePath}`);
      }
    }
  }

  assert.equal((await read('CNAME')).trim(), 'iselin.dev');
  const [home, blog, auth, privateClient] = await Promise.all([
    read('assets/home.js'),
    read('assets/blog.js'),
    read('assets/auth.js'),
    read('assets/private.js'),
  ]);
  assert.match(home, /fetch\('content\/posts\.json'/);
  assert.match(home, /`blog\/\?post=/);
  assert.match(blog, /fetch\('\.\.\/content\/posts\.json'/);
  assert.match(blog, /`\?post=/);
  assert.match(auth, /assign\('\.\.\/private\/'/);
  assert.match(privateClient, /replace\('\.\.\/login\/'/);
  assert.doesNotMatch([home, blog, auth, privateClient].join('\n'), /(?:assign|replace)\('\/|fetch\('\/|href = `\//);
});

test('browser code uses login-only Auth and does not expose a service-role key', async () => {
  const [auth, privateClient, supabaseClient, config] = await Promise.all([
    read('assets/auth.js'),
    read('assets/private.js'),
    read('assets/supabase-client.js'),
    read('supabase/config.js'),
  ]);
  assert.match(auth, /signInWithPassword/);
  assert.doesNotMatch(auth, /signUp\s*\(/);
  assert.match(supabaseClient, /rpc\('is_site_owner'\)/);
  assert.match(privateClient, /private-documents/);
  assert.match(config, /SUPABASE_CONFIG/);
  assert.doesNotMatch(config, /sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('database and storage policies restrict access to the configured owner', async () => {
  const schema = await read('supabase/schema.sql');
  assert.match(schema, /create schema if not exists private/i);
  assert.match(schema, /insert into private\.site_owner/i);
  assert.match(schema, /alter table private\.site_owner enable row level security/i);
  assert.match(schema, /revoke all on table private\.site_owner from public, anon, authenticated/i);
  assert.doesNotMatch(schema, /create policy[\s\S]*?on private\.site_owner/i);
  assert.match(schema, /create or replace function public\.is_site_owner\(\)[\s\S]*security definer[\s\S]*private\.site_owner/i);
  assert.match(schema, /alter table public\.notes enable row level security/i);
  assert.match(schema, /alter table public\.private_files enable row level security/i);
  assert.match(schema, /using \(\(select public\.is_site_owner\(\)\) and user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(schema, /values \('private-documents', 'private-documents', false,/i);
  assert.match(schema, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i);
  assert.doesNotMatch(schema, /\b(delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/i);
});
