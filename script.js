       //  Suhaib Ahmed 

        const OMDB_KEY = "30c212c1"; // required for live data
        const API = (q, page = 1, y = "") => `https://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(q)}${y ? `&y=${y}` : ""}&page=${page}`;
        const API_BY_ID = (id) => `https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${id}&plot=full`;

        const qs = (s, el = document) => el.querySelector(s);
        const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

        const state = { q: "", y: "", page: 1, total: 0, cache: new Map() };

        const results = qs('#results');
        const pager = qs('#pager');
        const pageNum = qs('#pageNum');
        const errorBox = qs('#error');
        const modal = qs('#movieModal');

        // Theme toggle 
        const themeToggle = qs('#themeToggle');
          themeToggle.addEventListener('click', ()=>{
          document.body.classList.toggle('light');
        });

        // Debounce helper
        const debounce = (fn, ms = 450) => {
            let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
        };

        // Render helpers
        function showError(msg) {
            errorBox.textContent = msg; errorBox.style.display = 'flex';
            setTimeout(() => errorBox.style.display = 'none', 3500);
        }

        function skeleton(count = 10) {
            results.innerHTML = Array.from({ length: count }).map(() => `
        <div class="card in">
          <div class="poster skeleton"></div>
          <div class="meta">
            <div class="skeleton" style="height:16px;border-radius:6px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
              <div class="skeleton" style="height:12px;width:60px;border-radius:10px"></div>
              <div class="skeleton" style="height:12px;width:40px;border-radius:10px"></div>
            </div>
          </div>
        </div>`).join('');
        }

        function empty() {
            results.innerHTML = `<div class="empty">🔎 No results. Try different keywords.</div>`;
            pager.style.display = 'none';
        }

        function cardHTML(item) {
            const poster = item.Poster && item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/400x600/0b1020/8aa2ff?text=No+Image';
            return `<article class="card" data-id="${item.imdbID}">
        <div class="poster">
          <img loading="lazy" src="${poster}" alt="${item.Title} poster"/>
          <div class="actions">
            <button class="icon-btn" title="More info" data-action="open">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="white"/><path d="M12 8v.01M12 12v4" stroke="white"/></svg>
            </button>
            <button class="icon-btn" title="Favorite" data-action="fav">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" stroke="white"/></svg>
            </button>
          </div>
        </div>
        <div class="meta">
          <h3 class="title">${item.Title}</h3>
          <div class="sub">
            <span class="chip">${item.Type}</span>
            <span>${item.Year}</span>
          </div>
        </div>
      </article>`
        }

        // Animate cards on view
        const inView = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); inView.unobserve(e.target); } });
        }, { threshold: .1 });

        function render(list) {
            if (!list || !list.length) { empty(); return; }
            results.innerHTML = list.map(cardHTML).join('');
            qsa('.card', results).forEach(c => inView.observe(c));
            // Attach listeners for actions
            results.addEventListener('click', onCardClick);
        }

        async function onCardClick(e) {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const card = e.target.closest('.card');
            const id = card?.dataset.id;
            if (btn.dataset.action === 'open' && id) { openModal(id); }
            if (btn.dataset.action === 'fav' && id) { toggleFav(id); btn.classList.toggle('active'); btn.style.filter = btn.classList.contains('active') ? 'drop-shadow(0 0 8px rgba(255,255,255,.4))' : '' }
        }

        // Favorites in localStorage
        const FAV_KEY = 'movie-favs-v1';
        function getFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return [] } }
        function setFavs(v) { localStorage.setItem(FAV_KEY, JSON.stringify(v)); }
        function toggleFav(id) {
            const favs = new Set(getFavs());
            favs.has(id) ? favs.delete(id) : favs.add(id);
            setFavs(Array.from(favs));
        }

        // Modal
        async function openModal(id) {
            try {
                const data = await getMovie(id);
                qs('#mTitle').textContent = `${data.Title} (${data.Year})`;
                qs('#mDetails').innerHTML = `
          <span>Rated: <strong>${data.Rated}</strong></span>
          <span>Runtime: <strong>${data.Runtime}</strong></span>
          <span>Genre: <strong>${data.Genre}</strong></span>
          <span>Director: <strong>${data.Director}</strong></span>
          <span>Actors: <strong>${data.Actors}</strong></span>
          <span>Language: <strong>${data.Language}</strong></span>`;
                qs('#mPlot').textContent = data.Plot;
                qs('#mPoster').src = (data.Poster && data.Poster !== 'N/A') ? data.Poster : 'https://via.placeholder.com/800x1200/0b1020/8aa2ff?text=No+Image';
                const rating = (data.Ratings && data.Ratings[0]?.Value) || data.imdbRating || 'N/A';
                qs('#mRating').textContent = `⭐ ${rating}`;
                modal.showModal();
            } catch (err) { showError('Failed to load details.'); }
        }
        qs('#closeModal').addEventListener('click', () => modal.close());

        async function getMovie(id) {
            if (state.cache.has(id)) return state.cache.get(id);
            const r = await fetch(API_BY_ID(id));
            const d = await r.json();
            if (d?.Response === 'False') throw new Error(d.Error || 'Not found');
            state.cache.set(id, d); return d;
        }

        // Search flow
        const qInput = qs('#query');
        const yInput = qs('#year');

        async function search(page = 1) {
            const query = state.q.trim();
            if (!query) { empty(); return; }
            skeleton();
            try {
                const url = API(query, page, state.y);
                const r = await fetch(url);
                const data = await r.json();
                if (data.Response === 'False') { empty(); return; }
                state.total = parseInt(data.totalResults || '0', 10);
                state.page = page;
                render(data.Search);
                // pager
                const totalPages = Math.ceil(state.total / 10);
                pageNum.textContent = `Page ${state.page} / ${totalPages}`;
                pager.style.display = totalPages > 1 ? 'flex' : 'none';
                qs('#prevBtn').disabled = state.page <= 1;
                qs('#nextBtn').disabled = state.page >= totalPages;
            } 
            catch (err) {
                empty(); showError('Network error');
            }
        }

        // Attach events
        qs('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); state.q = qInput.value; state.y = yInput.value; search(1); });
        qInput.addEventListener('input', debounce(() => { state.q = qInput.value; state.y = yInput.value; search(1); }, 550));
        yInput.addEventListener('input', debounce(() => { state.q = qInput.value; state.y = yInput.value; search(1); }, 650));

        qs('#prevBtn').addEventListener('click', () => search(state.page - 1));
        qs('#nextBtn').addEventListener('click', () => search(state.page + 1));


        qInput.value = 'Batman'; state.q = 'Batman'; search(1);

       

