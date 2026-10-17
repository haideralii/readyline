# Performance budgets, REQ-028 Session A1, before (`next` b03ce46), measured locally 17 Oct 2026 10:16 Sydney with the budget script and CI's settings

Lighthouse 12.8.2, mobile profile (emulated phone, 4G and a 4x slower CPU applied for real), performance category, against http://localhost:3100, one warm-up request per page; the median of each page's runs counts. Budgets: performance 90+, LCP 2500 ms, CLS 0.1, JavaScript on the questionnaire under 250 kB.

| Page | Runs | Performance | LCP | CLS | JavaScript | Flagged audits |
| --- | --- | --- | --- | --- | --- | --- |
| / | 3 | 92 | 1891 ms | 0 | 143.8 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /pricing | 3 | 94 | 1895 ms | 0 | 145.4 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, document-latency-insight |
| /start | 3 | 90 | 1721 ms | 0 | 191.8 kB | total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, first-contentful-paint |
| /start/business | 3 | 92 | 1754 ms | 0 | 210.8 kB | total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |

