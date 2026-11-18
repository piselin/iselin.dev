const list = document.querySelector('#latest-posts');
const empty = document.querySelector('#empty-state');

try {
  const response = await fetch('content/posts.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load posts.');
  const posts = await response.json();
  if (posts.length) {
    list.replaceChildren(...posts.slice(0, 3).map((post) => {
      const card = document.createElement('article');
      card.className = 'card post-card';
      const date = document.createElement('p');
      date.className = 'date';
      date.textContent = post.date || '';
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = `blog/?post=${encodeURIComponent(post.slug)}`;
      link.textContent = post.title || 'Untitled';
      heading.append(link);
      const summary = document.createElement('p');
      summary.className = 'quiet';
      summary.textContent = post.summary || '';
      card.append(date, heading, summary);
      return card;
    }));
    empty.hidden = true;
  }
} catch (error) {
  empty.textContent = 'Latest writing could not be loaded.';
  console.error(error);
}
