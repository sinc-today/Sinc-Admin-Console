/** Countries offered in filters. Any ISO alpha-2 works in the API; these are the likely ones. */
export const COUNTRY_OPTIONS = [
  ['RW', 'Rwanda'], ['UG', 'Uganda'], ['KE', 'Kenya'], ['TZ', 'Tanzania'], ['BI', 'Burundi'], ['CD', 'DR Congo'], ['SS', 'South Sudan'],
  ['ET', 'Ethiopia'], ['NG', 'Nigeria'], ['GH', 'Ghana'], ['ZA', 'South Africa'], ['AE', 'United Arab Emirates'], ['BE', 'Belgium'],
  ['FR', 'France'], ['GB', 'United Kingdom'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['US', 'United States'], ['CA', 'Canada'], ['IN', 'India'], ['CN', 'China'],
].map(([value, label]) => ({ value, label }));
