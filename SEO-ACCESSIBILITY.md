# SEO, Accessibility & Performance

## Public URLs
- Home: https://abbasali-code.github.io/khial_honar/
- Academy: https://abbasali-code.github.io/khial_honar/academy.html
- Sitemap: https://abbasali-code.github.io/khial_honar/sitemap.xml
- Robots: https://abbasali-code.github.io/khial_honar/robots.txt

## Google Search Console
1. Add the URL-prefix property `https://abbasali-code.github.io/khial_honar/` or verify your custom domain if you own one.
2. Verify ownership using one of Google's offered methods. Do not commit private tokens.
3. Submit `https://abbasali-code.github.io/khial_honar/sitemap.xml`.
4. Inspect the home and academy URLs and request indexing.
5. Review Page indexing, Core Web Vitals, HTTPS, and Enhancements reports.

## Indexing policy
- Public home and academy pages are indexable.
- `student.html` is intentionally marked `noindex,nofollow`; it contains account access and personal workspace functionality.
- `404.html` is marked `noindex`.
- The sitemap only lists canonical public pages.
- GitHub Pages deployment and crawling do not guarantee indexing or ranking.

## Accessibility baseline
- Persian language and RTL direction are declared.
- Skip links, visible keyboard focus, semantic landmarks, form labels, and reduced-motion overrides are included.
- Keep image alternative text meaningful; decorative images should use empty alt text.
- Preserve keyboard access when adding dialogs, menus, and dynamic controls.

## Performance baseline
- Non-critical gallery images use lazy loading and async decoding.
- Avoid loading unused font families and weights.
- Keep third-party scripts minimal; measure real-user Core Web Vitals after deployment.

## Agent and assistant discovery
- `llms.txt` summarizes public pages and content boundaries.
- `robots.txt` declares crawl preferences for common search and assistant discovery bots.
- These conventions are advisory and do not grant access to private content or APIs.
