// Central site configuration. Only fill in information that has been confirmed.
export default {
  // Public base URL, e.g. 'https://www.example.com' (no trailing slash). Used for canonical,
  // hreflang, Open Graph and the sitemap. Leave empty until the domain is known: relative URLs are used.
  siteUrl: '',
  // Form endpoint that accepts a JSON POST and answers 2xx on success. While empty, the contact
  // form works in "project brief" mode: nothing is sent, the brief can be copied or downloaded.
  contactEndpoint: '',
  languages: ['en', 'es', 'nl', 'pap'],
  defaultLanguage: 'en',
};
