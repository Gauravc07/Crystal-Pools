-- Page content may include PDF datasheets (e.g. product datasheets on the Products page).
update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'],
      file_size_limit = 10485760
  where id = 'pages';
