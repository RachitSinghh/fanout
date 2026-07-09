/**
 * Personalization token syntax: {{Token}} or {{Token|fallback text}}.
 * Token names are letters/digits/underscore/space; fallback is any text up to
 * the closing braces. Matching is global so we can find every occurrence.
 */
export const TOKEN_REGEX = /\{\{\s*([A-Za-z0-9_ ]+?)\s*(?:\|([^}]*))?\}\}/g;

/** Human-facing spec string surfaced inline in the UI. */
export const TOKEN_SYNTAX_HELP =
  'Use {{FirstName}} to insert a column value. Add a fallback with {{FirstName|there}}.';

/**
 * Header aliases used for fuzzy auto-mapping (TICKET-005). Keys are canonical
 * tokens; values are lowercased header fragments that map to them.
 */
export const AUTO_MAP_ALIASES: Record<string, string[]> = {
  email: ['email', 'e-mail', 'mail', 'email address', 'emailaddress'],
  FirstName: ['first name', 'firstname', 'first', 'fname', 'given name', 'givenname'],
  LastName: ['last name', 'lastname', 'last', 'lname', 'surname', 'family name', 'familyname'],
  Company: ['company', 'organization', 'organisation', 'org', 'business', 'employer'],
};
