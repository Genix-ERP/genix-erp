(function() {
  'use strict';

  // Find the script tag to read config
  var scripts = document.querySelectorAll('script[data-tenant]');
  var script = scripts[scripts.length - 1];
  if (!script) return;

  var config = {
    tenant: script.getAttribute('data-tenant') || '',
    color: script.getAttribute('data-color') || '#6366f1',
    lang: script.getAttribute('data-lang') || 'uz',
    position: script.getAttribute('data-position') || 'bottom-right',
    api: script.getAttribute('data-api') || 'https://api.genixerp.com/api/v1'
  };

  if (!config.tenant) {
    console.error('Genix Lead Form: data-tenant attribute is required');
    return;
  }

  var t = {
    uz: {
      title: 'Biz bilan bog\'laning',
      name: 'Ismingiz',
      email: 'Email',
      phone: 'Telefon',
      company: 'Kompaniya',
      message: 'Xabar',
      submit: 'Yuborish',
      success: 'Xabaringiz yuborildi!',
      error: 'Xatolik yuz berdi',
      required: 'Majburiy maydon'
    },
    ru: {
      title: 'Свяжитесь с нами',
      name: 'Ваше имя',
      email: 'Email',
      phone: 'Телефон',
      company: 'Компания',
      message: 'Сообщение',
      submit: 'Отправить',
      success: 'Сообщение отправлено!',
      error: 'Произошла ошибка',
      required: 'Обязательное поле'
    },
    en: {
      title: 'Contact Us',
      name: 'Your Name',
      email: 'Email',
      phone: 'Phone',
      company: 'Company',
      message: 'Message',
      submit: 'Submit',
      success: 'Message sent successfully!',
      error: 'Something went wrong',
      required: 'Required field'
    }
  };
  var l = t[config.lang] || t.uz;

  // Create styles
  var style = document.createElement('style');
  style.textContent = [
    '.gnx-btn{position:fixed;z-index:99999;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .2s}',
    '.gnx-btn:hover{transform:scale(1.1)}',
    '.gnx-btn svg{width:24px;height:24px;fill:#fff}',
    '.gnx-form-wrap{position:fixed;z-index:99998;width:360px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);overflow:hidden;display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.gnx-form-wrap.gnx-open{display:block;animation:gnxSlide .3s ease}',
    '@keyframes gnxSlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
    '.gnx-header{padding:16px 20px;color:#fff;font-size:16px;font-weight:600}',
    '.gnx-body{padding:16px 20px}',
    '.gnx-field{margin-bottom:12px}',
    '.gnx-field label{display:block;font-size:12px;font-weight:500;color:#64748b;margin-bottom:4px}',
    '.gnx-field input,.gnx-field textarea{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;transition:border .2s;box-sizing:border-box}',
    '.gnx-field input:focus,.gnx-field textarea:focus{border-color:' + config.color + '}',
    '.gnx-field textarea{resize:vertical;min-height:60px}',
    '.gnx-submit{width:100%;padding:12px;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s}',
    '.gnx-submit:hover{opacity:.9}',
    '.gnx-submit:disabled{opacity:.5;cursor:not-allowed}',
    '.gnx-msg{padding:12px 20px 16px;text-align:center;font-size:14px}',
    '.gnx-msg.gnx-ok{color:#16a34a}',
    '.gnx-msg.gnx-err{color:#dc2626}',
    '.gnx-powered{text-align:center;padding:8px;font-size:10px;color:#94a3b8}',
    '.gnx-powered a{color:#6366f1;text-decoration:none}',
    // Positions
    '.gnx-br{bottom:24px;right:24px}',
    '.gnx-bl{bottom:24px;left:24px}',
    '.gnx-form-br{bottom:90px;right:24px}',
    '.gnx-form-bl{bottom:90px;left:24px}'
  ].join('\n');
  document.head.appendChild(style);

  var posMap = {
    'bottom-right': {btn: 'gnx-br', form: 'gnx-form-br'},
    'bottom-left': {btn: 'gnx-bl', form: 'gnx-form-bl'}
  };
  var pos = posMap[config.position] || posMap['bottom-right'];

  // Create floating button
  var btn = document.createElement('button');
  btn.className = 'gnx-btn ' + pos.btn;
  btn.style.backgroundColor = config.color;
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  document.body.appendChild(btn);

  // Create form wrapper
  var wrap = document.createElement('div');
  wrap.className = 'gnx-form-wrap ' + pos.form;
  wrap.innerHTML = [
    '<div class="gnx-header" style="background:' + config.color + '">' + l.title + '</div>',
    '<div class="gnx-body">',
    '  <div class="gnx-field"><label>' + l.name + ' *</label><input type="text" id="gnx-name" required></div>',
    '  <div class="gnx-field"><label>' + l.phone + ' *</label><input type="tel" id="gnx-phone" placeholder="+998"></div>',
    '  <div class="gnx-field"><label>' + l.email + '</label><input type="email" id="gnx-email"></div>',
    '  <div class="gnx-field"><label>' + l.company + '</label><input type="text" id="gnx-company"></div>',
    '  <div class="gnx-field"><label>' + l.message + '</label><textarea id="gnx-notes" rows="2"></textarea></div>',
    '  <button class="gnx-submit" id="gnx-submit" style="background:' + config.color + '">' + l.submit + '</button>',
    '</div>',
    '<div class="gnx-msg" id="gnx-msg" style="display:none"></div>',
    '<div class="gnx-powered">Powered by <a href="https://genixerp.com" target="_blank">Genix ERP</a></div>'
  ].join('');
  document.body.appendChild(wrap);

  // Toggle form
  btn.addEventListener('click', function() {
    wrap.classList.toggle('gnx-open');
  });

  // Submit form
  var submitBtn = document.getElementById('gnx-submit');
  var msgEl = document.getElementById('gnx-msg');

  submitBtn.addEventListener('click', function() {
    var name = document.getElementById('gnx-name').value.trim();
    var phone = document.getElementById('gnx-phone').value.trim();
    var email = document.getElementById('gnx-email').value.trim();
    var company = document.getElementById('gnx-company').value.trim();
    var notes = document.getElementById('gnx-notes').value.trim();

    if (!name) { alert(l.required + ': ' + l.name); return; }
    if (!phone && !email) { alert(l.required + ': ' + l.phone + ' / ' + l.email); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '...';

    fetch(config.api + '/public/leads', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        tenant_code: config.tenant,
        contact_name: name,
        phone: phone,
        email: email,
        company_name: company,
        notes: notes,
        source: 'website',
        page_url: window.location.href
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        msgEl.className = 'gnx-msg gnx-ok';
        msgEl.textContent = l.success;
        msgEl.style.display = 'block';
        // Reset form
        document.getElementById('gnx-name').value = '';
        document.getElementById('gnx-phone').value = '';
        document.getElementById('gnx-email').value = '';
        document.getElementById('gnx-company').value = '';
        document.getElementById('gnx-notes').value = '';
        setTimeout(function() { msgEl.style.display = 'none'; }, 4000);
      } else {
        msgEl.className = 'gnx-msg gnx-err';
        msgEl.textContent = data.error || l.error;
        msgEl.style.display = 'block';
      }
    })
    .catch(function() {
      msgEl.className = 'gnx-msg gnx-err';
      msgEl.textContent = l.error;
      msgEl.style.display = 'block';
    })
    .finally(function() {
      submitBtn.disabled = false;
      submitBtn.textContent = l.submit;
    });
  });
})();
