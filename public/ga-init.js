// Google Analytics start-up. A file rather than inline code because the security policy blocks inline scripts.
(function () {
  var id = document.currentScript && document.currentScript.getAttribute('data-id');
  if (!id) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
  // Count call and WhatsApp clicks as leads
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) window.gtag('event', 'phone_click', { page_path: location.pathname });
    else if (href.indexOf('wa.me') !== -1) window.gtag('event', 'whatsapp_click', { page_path: location.pathname });
  }, true);
})();
