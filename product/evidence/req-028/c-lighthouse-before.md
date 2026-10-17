# Performance budgets, REQ-028 Session C, before (next c343642), measured locally 17 Oct 2026 19:32 Sydney with the budget script and CI's settings

Lighthouse 12.8.2, mobile profile (emulated phone, 4G and a 4x slower CPU applied for real), performance category, against http://localhost:3100, one warm-up request per page; the median of each page's runs counts. Budgets: performance 90+, LCP 2500 ms, CLS 0.1, JavaScript on the questionnaire under 250 kB.

| Page | Runs | Performance | LCP | CLS | JavaScript | Flagged audits |
| --- | --- | --- | --- | --- | --- | --- |
| / | 3 | 91 | 1931 ms | 0 | 145.5 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /pricing | 3 | 93 | 1832 ms | 0 | 145.9 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /start | 3 | 86 | 1761 ms | 0 | 192.9 kB | total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /start/business | 3 | 95 | 1823 ms | 0 | 213.2 kB | first-contentful-paint, total-blocking-time, max-potential-fid, interactive, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |

