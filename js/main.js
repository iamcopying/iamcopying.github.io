(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  var filterInput = document.getElementById('post-filter');
  var postList = document.getElementById('post-list');
  var searchDataEl = document.getElementById('search-data');
  var originalPostListHTML = postList ? postList.innerHTML : '';
  var searchIndex = [];

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (m) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m];
    });
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightText(text, keyword) {
    var raw = String(text || '');
    if (!keyword) return escapeHtml(raw);
    var re = new RegExp(escapeRegExp(keyword), 'ig');
    var output = '';
    var last = 0;
    var match;
    while ((match = re.exec(raw)) !== null) {
      output += escapeHtml(raw.slice(last, match.index));
      output += '<mark class="search-hit">' + escapeHtml(match[0]) + '</mark>';
      last = match.index + match[0].length;
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
    output += escapeHtml(raw.slice(last));
    return output;
  }

  function buildSnippet(text, keyword) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    if (!keyword) return raw.slice(0, 120);
    var idx = raw.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return raw.slice(0, 120);
    var start = Math.max(0, idx - 36);
    var end = Math.min(raw.length, idx + keyword.length + 84);
    var snippet = raw.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < raw.length) snippet += '...';
    return snippet;
  }

  function prettifyLanguageName(lang) {
    var key = String(lang || '').trim().toLowerCase();
    var aliases = {
      js: 'JavaScript',
      jsx: 'JSX',
      ts: 'TypeScript',
      tsx: 'TSX',
      c: 'C',
      cpp: 'C++',
      cxx: 'C++',
      h: 'C Header',
      hpp: 'C++ Header',
      cs: 'C#',
      py: 'Python',
      rb: 'Ruby',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      kt: 'Kotlin',
      swift: 'Swift',
      sh: 'Shell',
      bash: 'Bash',
      zsh: 'Zsh',
      ps1: 'PowerShell',
      html: 'HTML',
      xml: 'XML',
      css: 'CSS',
      scss: 'SCSS',
      less: 'Less',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      toml: 'TOML',
      ini: 'INI',
      md: 'Markdown',
      sql: 'SQL',
      plaintext: 'Text',
      text: 'Text'
    };

    if (!key) return '';
    if (aliases[key]) return aliases[key];
    return key.replace(/(^|-)([a-z])/g, function (_, dash, letter) {
      return (dash ? ' ' : '') + letter.toUpperCase();
    });
  }

  function getCodeLanguage(block) {
    var blockLanguage = block.getAttribute('data-language');
    if (blockLanguage) return prettifyLanguageName(blockLanguage);

    var host = block.closest('figure.highlight, pre');
    if (host && host.getAttribute('data-language')) {
      return prettifyLanguageName(host.getAttribute('data-language'));
    }

    var classes = (block.className || '').split(/\s+/);
    for (var i = 0; i < classes.length; i += 1) {
      var cls = classes[i];
      if (!cls || cls === 'hljs') continue;
      if (cls.indexOf('language-') === 0) return prettifyLanguageName(cls.slice(9));
      if (cls.indexOf('lang-') === 0) return prettifyLanguageName(cls.slice(5));
      if (/^[a-z0-9#+._-]+$/i.test(cls)) return prettifyLanguageName(cls);
    }

    return '';
  }

  function applyCodeLanguages() {
    var blocks = document.querySelectorAll('.post-content pre code, .post-content figure.highlight code');

    blocks.forEach(function (block) {
      var host = block.closest('figure.highlight') || block.parentElement;
      var language = getCodeLanguage(block);

      if (!host || !language) return;
      host.setAttribute('data-language', language);
    });
  }

  function normalizeHighlightLines() {
    var blocks = document.querySelectorAll('.post-content figure.highlight td.code code.hljs');

    blocks.forEach(function (block) {
      if (block.dataset.linesNormalized === 'yes') return;

      var html = block.innerHTML.replace(/\r\n/g, '\n');
      var lines = html.split(/<br\s*\/?>/i);

      if (lines.length <= 1) {
        block.dataset.linesNormalized = 'yes';
        return;
      }

      if (lines.length && lines[lines.length - 1] === '') {
        lines.pop();
      }

      block.innerHTML = lines.map(function (line) {
        return '<span class="code-line">' + (line || '&nbsp;') + '</span>';
      }).join('');

      block.dataset.linesNormalized = 'yes';
    });
  }

  function getCodeText(block) {
    var lineBlocks = block.querySelectorAll('.code-line');

    if (lineBlocks.length) {
      return Array.prototype.map.call(lineBlocks, function (line) {
        return line.textContent.replace(/\u00a0/g, ' ');
      }).join('\n');
    }

    return block.textContent.replace(/\u00a0/g, ' ');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        resolve();
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  function injectCopyButtons() {
    var hosts = document.querySelectorAll('.post-content figure.highlight, .post-content pre');

    hosts.forEach(function (host) {
      if (host.matches('pre') && host.closest('figure.highlight')) return;

      var code = host.querySelector('code');
      if (!code || host.dataset.copyReady === 'yes') return;

      host.classList.add('code-block-ready');

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy-button';
      button.textContent = '复制';

      button.addEventListener('click', function () {
        var original = button.textContent;

        copyText(getCodeText(code)).then(function () {
          button.textContent = '已复制';
          button.classList.add('is-copied');
          window.setTimeout(function () {
            button.textContent = original;
            button.classList.remove('is-copied');
          }, 1600);
        }).catch(function () {
          button.textContent = '复制失败';
          window.setTimeout(function () {
            button.textContent = original;
          }, 1600);
        });
      });

      host.appendChild(button);
      host.dataset.copyReady = 'yes';
    });
  }

  if (searchDataEl) {
    try {
      searchIndex = JSON.parse(searchDataEl.textContent || '[]');
    } catch (e) {
      searchIndex = [];
    }
  }

  var saved = localStorage.getItem('nova-theme');
  if (saved === 'dark') {
    root.setAttribute('data-theme', 'dark');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      if (current === 'dark') {
        root.removeAttribute('data-theme');
        localStorage.setItem('nova-theme', 'light');
      } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('nova-theme', 'dark');
      }
    });
  }

  if (filterInput && postList && searchIndex.length) {
    filterInput.addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      if (!q) {
        postList.innerHTML = originalPostListHTML;
        return;
      }

      var matches = searchIndex.filter(function (item) {
        var title = (item.title || '').toLowerCase();
        var text = (item.text || '').toLowerCase();
        return title.indexOf(q) > -1 || text.indexOf(q) > -1;
      }).slice(0, 60);

      if (!matches.length) {
        postList.innerHTML = '<p class="empty">No posts found.</p>';
        return;
      }

      postList.innerHTML = matches.map(function (item) {
        var snippet = buildSnippet(item.text || item.firstLine || '', q);
        return '' +
          '<article class="post-card">' +
          '  <h2 class="post-title"><a href="' + item.path + '">' + highlightText(item.title, q) + '</a></h2>' +
          '  <div class="post-summary"><time>' + escapeHtml(item.date) + '</time><span class="post-summary-sep">-</span><div class="post-excerpt">' + highlightText(snippet, q) + '</div></div>' +
          '</article>';
      }).join('');
    });
  }

  if (window.hljs) {
    window.hljs.configure({ cssSelector: '.post-content pre code:not(.hljs)' });
    window.hljs.highlightAll();
  }

  normalizeHighlightLines();
  applyCodeLanguages();
  injectCopyButtons();
})();
