;(function(){
  const SUPABASE_URL = window.SUPABASE_URL || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : null) || 'https://YOUR-PROJECT.supabase.co';
  const SUPABASE_ANON = window.SUPABASE_ANON || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : null) || 'YOUR-ANON-KEY';
  const BUCKET = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_BUCKET : null) || 'listing-images';

  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // Eksportér lille “namespace”
  window.Dahl = { supa, requireAdmin, renderAdmin };

  const qs = (sel, el=document)=>el.querySelector(sel);
  const qsa = (sel, el=document)=>Array.from(el.querySelectorAll(sel));
  const currency = (n)=> Number(n||0).toLocaleString('da-DK');

  // UI basics
  window.addEventListener('DOMContentLoaded', init);

  async function init(){
    const yearEl = qs('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Auth UI
    const { data: { session } } = await supa.auth.getSession();
    setAuthUI(session);

    // Auth knapper
    qs('#btnLogin')?.addEventListener('click', showAuthDialog);
    qs('#footerLogin')?.addEventListener('click', showAuthDialog);
    qs('#btnLogout')?.addEventListener('click', logout);

    // Mobile nav
    const toggle = qs('.nav-toggle'); const menu = qs('#navMenu');
    toggle?.addEventListener('click', ()=>{ const open = toggle.getAttribute('aria-expanded')==='true'; toggle.setAttribute('aria-expanded', String(!open)); menu.classList.toggle('open'); });

    // Kurv
    cartInit();

    // PayPal render ved åbning af kurv
    qs('.cart-open')?.addEventListener('click', renderPayPal);

    // Side-specifik init
    if (qs('#arrivalsGrid')) renderArrivals();             // index
    if (qs('#sellForm')) initSellForm();                   // index
    if (qs('#allGrid')) initListingsPage();                // listings
  }

  function setAuthUI(session){
    const userSpan = qs('#authUser');
    const btnLogin = qs('#btnLogin');
    const btnLogout = qs('#btnLogout');
    const adminLink = qs('#adminLink');

    if (session?.user){
      userSpan.textContent = session.user.email;
      btnLogin?.classList.add('hide');
      btnLogout?.classList.remove('hide');
      const role = session.user.app_metadata?.role;
      if (role === 'admin') adminLink?.classList.remove('hide'); else adminLink?.classList.add('hide');
    } else {
      userSpan.textContent = '';
      btnLogin?.classList.remove('hide');
      btnLogout?.classList.add('hide');
      adminLink?.classList.add('hide');
    }
  }

  async function showAuthDialog(){
    const email = prompt('Email:');
    if (!email) return;
    const mode = confirm('OK = Log ind · Annuller = Opret konto');
    const password = prompt('Adgangskode (min 6 tegn):'); if (!password) return;
    try{
      if (mode){
        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supa.auth.signUp({ email, password });
        if (error) throw error;
        alert('Konto oprettet. Tjek evt. bekræftelsesmail, hvis aktiveret.');
      }
      const { data: { session } } = await supa.auth.getSession();
      setAuthUI(session);
      location.reload();
    }catch(e){ alert('Auth-fejl: ' + e.message); }
  }

  async function logout(){
    await supa.auth.signOut();
    setAuthUI(null);
    location.href = 'index.html';
  }

  // ===== Kurv + betaling =====
  const cartState = { items: [] };
  function cartInit(){
    const cartOpenBtn = qs('.cart-open');
    const cartDrawer = qs('.cart-drawer');
    const cartCloseBtn = qs('.cart-close');
    const cartBackdrop = qs('.cart-backdrop');

    function open(){ cartDrawer?.classList.add('open'); cartDrawer?.setAttribute('aria-hidden','false'); }
    function close(){ cartDrawer?.classList.remove('open'); cartDrawer?.setAttribute('aria-hidden','true'); }

    cartOpenBtn?.addEventListener('click', open);
    cartCloseBtn?.addEventListener('click', close);
    cartBackdrop?.addEventListener('click', close);

    document.body.addEventListener('click', (e)=>{
      const addBtn = e.target.closest('.add-to-cart');
      if (addBtn){
        e.preventDefault();
        const title = addBtn.dataset.title || 'Kort';
        const price = Number(addBtn.dataset.price || 0);
        const badge = addBtn.dataset.badge || '';
        const existing = cartState.items.find(i => i.title === title && i.price === price);
        if (existing) existing.qty += 1; else cartState.items.push({ title, price, badge, qty: 1 });
        renderCart(); open();
      }
      const removeBtn = e.target.closest('.icon-btn[data-idx]');
      if (removeBtn){
        const idx = Number(removeBtn.dataset.idx); cartState.items.splice(idx,1); renderCart();
      }
    });

    qs('#payStripe')?.addEventListener('click', payStripe);
    renderCart();
  }

  function renderCart(){
    const cartList = qs('#cartList'); const cartSubtotal = qs('#cartSubtotal'); const cartCount = qs('.cart-count');
    if (!cartList) return;
    cartList.innerHTML = ''; let subtotal = 0;
    cartState.items.forEach((it, idx)=>{
      subtotal += it.price * it.qty;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <div class="cart-item-badge">${it.badge || ''}</div>
        <div class="cart-item-info"><strong>${it.title}</strong><div class="small">Antal: ${it.qty}</div></div>
        <div class="cart-item-actions">
          <span>DKK ${currency(it.price*it.qty)}</span>
          <button class="icon-btn" data-idx="${idx}" aria-label="Fjern"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      cartList.appendChild(li);
    });
    cartSubtotal && (cartSubtotal.textContent = subtotal.toLocaleString('da-DK'));
    cartCount && (cartCount.textContent = cartState.items.reduce((a,b)=>a+b.qty,0));
  }

  async function payStripe(){
    if (!cartState.items.length) return alert('Din kurv er tom.');
    try{
      const res = await fetch('/api/stripe/create-checkout-session', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          items: cartState.items,
          successUrl: window.location.origin + '/index.html?paid=stripe-success',
          cancelUrl: window.location.origin + '/index.html?paid=stripe-cancel'
        })
      });
      const data = await res.json();
      if (data?.url) window.location = data.url; else alert('Kunne ikke starte Stripe checkout.');
    }catch(e){ console.error(e); alert('Fejl ved Stripe checkout.'); }
  }

  function renderPayPal(){
    if (!window.paypal) return;
    const el = qs('#paypalContainer'); if (!el) return; el.innerHTML = '';
    window.paypal.Buttons({
      style: { layout:'horizontal', height:45, label:'paypal' },
      createOrder: async () => {
        const items = cartState.items.map(it => ({ title: it.title, price: Number(it.price), qty: Number(it.qty||1) }));
        if (!items.length){ alert('Din kurv er tom.'); return; }
        const res = await fetch('/api/paypal/create-order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items }) });
        const data = await res.json(); return data.id;
      },
      onApprove: async (data) => {
        const res = await fetch('/api/paypal/capture-order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: data.orderID }) });
        await res.json(); alert('Tak for din ordre! (PayPal)'); cartState.items = []; renderCart();
      },
      onError: (err) => { console.error(err); alert('PayPal-fejl.'); }
    }).render('#paypalContainer');
  }

  // ===== Index: Nye varer (seneste 8) =====
  async function renderArrivals(){
    const grid = qs('#arrivalsGrid'); if (!grid) return;
    const { data, error } = await supa.from('listings').select('*').order('created_at', { ascending: false }).limit(8);
    if (error){ console.error(error); return; }
    grid.innerHTML = '';
    data.forEach(item => grid.appendChild(productCard(item)));
  }

  function productCard(item){
    const art = document.createElement('article');
    art.className = 'product-card';
    art.innerHTML = `
      <div class="product-media">
        <img src="${item.img || 'https://picsum.photos/600/400?blur=1'}" alt="${item.title}" />
        <span class="badge">${item.badge || ''}</span>
      </div>
      <div class="product-info">
        <h3 class="product-title">${item.title}</h3>
        <p class="product-meta">${[item.set_name, item.number].filter(Boolean).join(' • ') || ''}</p>
        <div class="product-buy">
          <span class="price">DKK ${currency(item.price)}</span>
          <a href="#" class="btn btn-sm btn-primary add-to-cart" data-title="${item.title}" data-price="${item.price}" data-badge="${item.badge||''}">Læg i kurv</a>
        </div>
      </div>`;
    return art;
  }

  // ===== Sælg: upload + insert =====
  function initSellForm(){
    const form = qs('#sellForm'); const msg = qs('#sellMsg');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      msg.textContent = '';
      const { data: { session } } = await supa.auth.getSession();
      if (!session?.user) { alert('Log ind for at oprette opslag.'); return; }

      // Felter
      const file = qs('#photo').files[0];
      const title = qs('#title').value.trim();
      const setName = qs('#set').value.trim();
      const number = qs('#number').value.trim();
      const condition = qs('#condition').value;
      const category = qs('#category').value;
      const badge = qs('#badge').value.trim();
      const price = Number(qs('#price').value);

      if (!file){ msg.textContent = 'Vælg et billede.'; return; }

      try{
        // Upload til Storage
        const ext = file.name.split('.').pop();
        const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supa.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
        if (up.error) throw up.error;

        const { data: publicUrl } = supa.storage.from(BUCKET).getPublicUrl(path);
        const img = publicUrl.publicUrl;

        // Insert i DB
        const { data, error } = await supa.from('listings').insert([{
          user_id: session.user.id,
          title, price, badge, set_name: setName, number, img, condition, category
        }]).select('*').single();
        if (error) throw error;

        msg.textContent = 'Opslag oprettet!';
        form.reset();
        await renderArrivals();
      } catch (err){
        console.error(err);
        msg.textContent = 'Fejl ved oprettelse: ' + err.message;
      }
    });
  }

  // ===== Listings-side =====
  function initListingsPage(){
    const searchEl = qs('#search'); const condEl = qs('#cond'); const sortEl = qs('#sort'); const perPageEl = qs('#perPage');
    const allGrid = qs('#allGrid'); const prevPage = qs('#prevPage'); const nextPage = qs('#nextPage'); const pageInfo = qs('#pageInfo');
    let page = 1;

    async function fetchData(){
      let q = supa.from('listings').select('*', { count:'exact' });

      // Stand/condition filter
      const cond = condEl.value;
      if (cond) q = q.ilike('condition', cond);

      // Søg
      const s = (searchEl.value || '').trim();
      if (s){
        // simpelt: client filter senere — for demo; eller brug full-text
      }

      // Sort
      const sort = sortEl.value;
      if (sort === 'priceAsc') q = q.order('price', { ascending: true });
      else if (sort === 'priceDesc') q = q.order('price', { ascending: false });
      else q = q.order('created_at', { ascending: false });

      // Pagination
      const per = Number(perPageEl.value || 12);
      const from = (page-1)*per; const to = from + per - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error){ console.error(error); return { rows:[], total:0 }; }

      // Client side søg i den slice vi trak
      const rows = s ? data.filter(it => (it.title + ' ' + (it.set_name||'') + ' ' + (it.number||'')).toLowerCase().includes(s.toLowerCase())) : data;
      return { rows, total: count || rows.length };
    }

    async function render(){
      const { rows, total } = await fetchData();
      allGrid.innerHTML = '';
      rows.forEach(item => allGrid.appendChild(productCard(item)));

      const per = Number(perPageEl.value || 12);
      const totalPages = Math.max(1, Math.ceil(total / per));
      page = Math.min(page, totalPages);
      pageInfo.textContent = `Side ${page}/${totalPages}`;
      prevPage.disabled = page <= 1; nextPage.disabled = page >= totalPages;
    }

    ;['input','change'].forEach(ev=>{
      searchEl.addEventListener(ev, ()=>{ page=1; render(); });
      condEl.addEventListener(ev, ()=>{ page=1; render(); });
      sortEl.addEventListener(ev, ()=>{ page=1; render(); });
      perPageEl.addEventListener(ev, ()=>{ page=1; render(); });
    });
    prevPage.addEventListener('click', ()=>{ if (page>1){ page--; render(); } });
    nextPage.addEventListener('click', ()=>{ page++; render(); });

    render();
  }

  // ===== Admin =====
  async function requireAdmin(){
    const { data: { session } } = await supa.auth.getSession();
    if (!session?.user) { alert('Log ind kræves.'); location.href='index.html'; return false; }
    const role = session.user.app_metadata?.role;
    if (role !== 'admin'){ return false; }
    return true;
  }

  async function renderAdmin(){
    const grid = qs('#adminGrid'); if (!grid) return;
    const { data, error } = await supa.from('listings').select('*').order('created_at', { ascending:false });
    if (error){ console.error(error); return; }
    grid.innerHTML = '';
    data.forEach(item => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-media">
          <img src="${item.img || ''}" alt="${item.title}" />
          <span class="badge">${item.badge || ''}</span>
        </div>
        <div class="product-info">
          <h3 class="product-title">${item.title}</h3>
          <p class="product-meta">DKK ${currency(item.price)} • ${item.set_name || ''} ${item.number || ''}</p>
          <div class="product-buy">
            <button class="btn btn-sm btn-secondary" data-edit="${item.id}"><i class="fa-regular fa-pen-to-square"></i> Redigér</button>
            <button class="btn btn-sm btn-outline" data-del="${item.id}"><i class="fa-regular fa-trash-can"></i> Slet</button>
          </div>
        </div>`;
      grid.appendChild(card);
    });

    grid.addEventListener('click', async (e)=>{
      const del = e.target.closest('[data-del]'); const edit = e.target.closest('[data-edit]');
      if (del){
        const id = del.getAttribute('data-del');
        if (!confirm('Slet dette opslag?')) return;
        const { error } = await supa.from('listings').delete().eq('id', id);
        if (error){ alert('Fejl ved sletning: ' + error.message); return; }
        renderAdmin();
      }
      if (edit){
        const id = edit.getAttribute('data-edit');
        const title = prompt('Ny titel:'); if (!title) return;
        const price = Number(prompt('Ny pris (DKK):')); if (Number.isNaN(price)) return;
        const { error } = await supa.from('listings').update({ title, price }).eq('id', id);
        if (error){ alert('Fejl ved opdatering: ' + error.message); return; }
        renderAdmin();
      }
    });
  }
})();
