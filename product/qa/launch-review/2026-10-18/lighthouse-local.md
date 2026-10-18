# Lighthouse budgets on the local production build (REQ-012 FR-5; this laptop, 19 Oct 2026, median of three; the CI runner's runs are the measurement that counts, D-2276 (5))


Lighthouse 12.8.2, mobile profile (emulated phone, 4G and a 4x slower CPU applied for real), performance category, against http://localhost:3100, one warm-up request per page; the median of each page's runs counts. Budgets: performance 90+, LCP 2500 ms, CLS 0.1, JavaScript on the questionnaire under 250 kB.

| Page | Class | Runs | Performance | LCP | CLS | JavaScript | Bytes | TTFB | Flagged audits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | public content | 3 | 87 | 1968 ms | 0 | 147.3 kB | 281.7 kB | 11 ms | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, mainthread-work-breakdown |
| /pricing | public content | 3 | 90 | 1941 ms | 0 | 147.7 kB | 274.3 kB | 13 ms | first-contentful-paint, total-blocking-time, max-potential-fid, interactive, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /guides/which-ndis-audit | public content | 3 | 84 | 2082 ms | 0 | 148.5 kB | 288.6 kB | 54 ms | first-contentful-paint, total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, dom-size, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, mainthread-work-breakdown, largest-contentful-paint, interactive, bootup-time, largest-contentful-paint-element, document-latency-insight |
| /start | questionnaire | 3 | 81 | 1969 ms | 0 | 194.4 kB | 322.6 kB | 12 ms | first-contentful-paint, total-blocking-time, max-potential-fid, mainthread-work-breakdown, bootup-time, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight |
| /start/business | questionnaire | 3 | 87 | 1860 ms | 0 | 217 kB | 344.5 kB | 12 ms | total-blocking-time, max-potential-fid, render-blocking-resources, unused-javascript, legacy-javascript, bf-cache, forced-reflow-insight, legacy-javascript-insight, network-dependency-tree-insight, render-blocking-insight, first-contentful-paint, mainthread-work-breakdown |

Budgets (REQ-012 FR-5): performance 90 or more, LCP 2,500 ms or less, CLS 0.1 or less, TTFB 800 ms or less on every page; questionnaire JavaScript under 250 kB; total transfer per class:

| Class | Pages | Bytes budget |
| --- | --- | --- |
| public content | /, /pricing, /guides/which-ndis-audit | 700 kB |
| questionnaire | /start, /start/business | 900 kB |
| signed-in | /documents, /registers, /worker | 1200 kB |

