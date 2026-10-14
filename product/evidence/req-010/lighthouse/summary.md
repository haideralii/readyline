# Performance budgets (REQ-010, backlog 2)

Run 2026-10-14 with scripts/ops/lighthouse-budget.test.ts against a local production build.

Lighthouse 12.8.2, mobile profile (emulated phone, 4G and a 4x slower CPU applied for real), performance category, against http://localhost:3100, one warm-up request per page; the median of each page's runs counts. Budgets: performance 90+, LCP 2500 ms, CLS 0.1, JavaScript on the questionnaire under 250 kB.

| Page | Runs | Performance | LCP | CLS | JavaScript | Flagged audits |
| --- | --- | --- | --- | --- | --- | --- |
| / | 3 | 92 | 1962 ms | 0 | 143.8 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /pricing | 3 | 94 | 1945 ms | 0 | 145.4 kB | first-contentful-paint, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, total-blocking-time |
| /start | 3 | 92 | 1826 ms | 0 | 149.3 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /start/business | 3 | 91 | 1913 ms | 0 | 155.4 kB | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, interactive, mainthread-work-breakdown |
| /documents | 3 | 95 | 1892 ms | 0 | 145.6 kB | first-contentful-paint, total-blocking-time, max-potential-fid, unused-javascript, legacy-javascript, bf-cache, legacy-javascript-insight, forced-reflow-insight |

