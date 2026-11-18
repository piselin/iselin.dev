const list = document.querySelector('#post-list');
const empty = document.querySelector('#empty-state');
const message = document.querySelector('#blog-message');
const params = new URLSearchParams(window.location.search);
const slug = params.get('post');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

try {
  const response = await fetch('/content/posts.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load posts.');
  const posts = await response.json();

  if (slug) {
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      message.textContent = 'That post could not be found.';
      message.hidden = false;
    } else {
      const article = element('article', undefined, 'narrow');
      article.append(element('p', post.date || '', 'eyebrow'), element('h1', post.title || 'Untitled', 'page-title'), element('div', post.body || '', 'prose'));
      list.replaceChildren(article);
      empty.hidden = true;
    }
  } else if (posts.length) {
    list.replaceChildren(...posts.map((post) => {
      const card = element('article', undefined, 'card post-card');
      card.append(element('p', post.date || '', 'date'));
      const heading = element('h2');
      const link = element('a', post.title || 'Untitled');
      link.href = `/blog/?post=${encodeURIComponent(post.slug)}`;
      heading.append(link);
      card.append(heading, element('p', post.summary || '', 'quiet'));
      return card;
    }));
    empty.hidden = true;
  }
} catch (error) {
  message.textContent = 'Blog posts could not be loaded.';
  message.hidden = false;
  console.error(error);
}
