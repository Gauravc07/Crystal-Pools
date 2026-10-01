-- Seed site settings with the values that were hard-coded on the website.
update public.site_settings set
  address = 'Sr. No. 10/1/1, Shed No. 3&4, Nr. Kailash Jeevan Factory, Dhayari, Pune 411041',
  map_lat = 18.4372,
  map_lng = 73.8052,
  social_links = '{
    "instagram": "https://www.instagram.com/crystalpoolspune/",
    "facebook": "https://www.facebook.com/crystalpoolspune/",
    "linkedin": "https://www.linkedin.com/company/crystal-swimming-pools/"
  }'::jsonb
where id = 1 and social_links = '{}'::jsonb;
