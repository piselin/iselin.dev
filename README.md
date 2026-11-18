# iselin.dev

A static personal site designed for free GitHub Pages hosting. It includes a public blog (empty until you add posts) and an owner-only private space for notes and documents, backed by Supabase Auth, Postgres Row Level Security, and a private Storage bucket. The welcome text is a placeholder; there are no invented personal details or sample posts.

## Local preview

The site has no build step or npm dependencies. It uses Node.js only for the test runner; serve the folder with any static web server, then open its local URL. For example, with Python installed:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Configure Supabase first if you want to test the private area. `npm test` runs static/security-boundary checks (Node.js 20+).

## Configure Supabase

Create a Supabase project in your own account. The free plan and its limits can change; check Supabase's current pricing, storage, bandwidth, and inactivity policies before relying on it for private files.

1. In Supabase Authentication settings, disable public user sign-ups. Create the one owner account yourself from the project's Authentication > Users admin screen; do not add a sign-up page to this site.
2. Copy the owner's Auth user UUID. Open `supabase/schema.sql`, replace the all-zero UUID in its final `insert` statement with that UUID, then run the full script in the Supabase SQL Editor. It creates the owner allow-list, notes and file metadata tables, RLS policies, and a non-public `private-documents` bucket with explicit owner-only read/upload/delete policies. `private.site_owner` has RLS enabled and grants no table access to browser roles; the `SECURITY DEFINER` owner-check function is the only client-callable way to check the allow-list.
3. In Project Settings > API, copy the project URL and the public publishable/anon key into `supabase/config.js`. These two values are intended to be visible to browsers. **Never put a service-role/secret key in this repository or browser code.** The private-area security boundary is Supabase Auth plus the SQL policies, not the obscurity of these values or URLs.
4. The owner must use the same email and password configured for the Supabase Auth user to sign in at `/login/`. The private site checks `is_site_owner()` before displaying content. Even if another account were created by an administrator, the SQL policies deny it access unless its UUID is the one explicitly provisioned in `private.site_owner`.

The SQL Editor may warn about destructive operations because the setup replaces policies by their exact names (`drop policy if exists` followed by `create policy`) and alters/creates schema objects. Those policy statements remove policy definitions, not table rows or uploaded files; the script contains no `DELETE`, `TRUNCATE`, or `DROP TABLE` statements. Its final `ON CONFLICT` clause updates only the single owner allow-list row to the UUID you supplied. Review that UUID before running. The foreign keys' `ON DELETE CASCADE` behavior applies only if an Auth user is separately deleted; this script does not delete Auth users. Password resets are handled in Supabase Auth; this site has no password-reset, sign-up, or MFA challenge flow.

## Add a public post

Add entries to `content/posts.json` in this shape:

```json
[
  {
    "slug": "first-post",
    "title": "A title you choose",
    "date": "2026-11-18",
    "summary": "A short introduction.",
    "body": "The post text. Newlines are preserved."
  }
]
```

Use a unique lowercase slug containing only letters, numbers, and hyphens. This file is public when the site is published; never put private notes, documents, credentials, or personal data here. Post bodies are rendered as text, not HTML.

## GitHub Pages and Hostpoint

The public source is in [github.com/piselin/iselin.dev](https://github.com/piselin/iselin.dev). GitHub Pages is enabled from the `main` branch root, the custom domain is set to `iselin.dev`, and the root `CNAME` file records it. GitHub reports the domain as verified. HTTPS enforcement is currently off because GitHub has not issued the certificate yet. The site supports both the apex root and the GitHub project Pages path.

The apex domain is **not confirmed live yet**: its DNS has not been changed. No Hostpoint DNS or redirect settings were changed. GitHub already reports `iselin.dev` as verified for this account, so no additional verification TXT record should be needed; keep any existing GitHub verification TXT record in place.

GitHub's [current apex-domain guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain) lists these Hostpoint DNS targets for `iselin.dev`:

| Type | Host/name | Value |
| --- | --- | --- |
| A | `@` (apex) | `185.199.108.153` |
| A | `@` (apex) | `185.199.109.153` |
| A | `@` (apex) | `185.199.110.153` |
| A | `@` (apex) | `185.199.111.153` |
| AAAA | `@` (apex) | `2606:50c0:8000::153` |
| AAAA | `@` (apex) | `2606:50c0:8001::153` |
| AAAA | `@` (apex) | `2606:50c0:8002::153` |
| AAAA | `@` (apex) | `2606:50c0:8003::153` |
| CNAME | `www` | `piselin.github.io` |

GitHub requires at least one apex `A`, `ALIAS`, or `ANAME` record; its guide recommends these four `A` addresses. The four `AAAA` records add IPv6 support, and GitHub recommends keeping the `A` records alongside them. If Hostpoint offers `ALIAS`/`ANAME`, that can be used instead of the apex `A` records as documented by GitHub. Set `www` to a CNAME of `piselin.github.io` (without a repository path); once both hostnames resolve correctly, GitHub Pages redirects between `www` and the apex configured for this site.

At Hostpoint, add the listed records if they are not already present. Remove only records that conflict with the GitHub Pages targets (for example, old apex `A`/`AAAA` values or conflicting `www` address records). Preserve all MX records and existing email-related or unrelated TXT records. Do not use wildcard DNS. DNS propagation can take up to 24 hours. Once DNS resolves to GitHub Pages and the HTTPS certificate is ready, enable **Enforce HTTPS** in the repository's Pages settings. For the eventual apex URL, set the Supabase Auth production/redirect URL to `https://iselin.dev/`.

GitHub Pages serves the files publicly, including HTML, JavaScript, the empty/public blog content, and the Supabase URL/public key. It never contains private notes, file contents, or a service-role key. Private content is fetched directly from Supabase only after sign-in; database RLS and the private Storage policies enforce owner-only access. The private HTML files themselves are public static shells and are not an access boundary.

`npm test` checks that required static pages/configuration exist, public posts are empty by default, browser code does not contain a service-role key, and the SQL schema includes owner-restricted RLS and a private bucket. These checks do not connect to or provision a Supabase project.
