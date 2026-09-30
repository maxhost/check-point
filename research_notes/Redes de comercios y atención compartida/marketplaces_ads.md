# How marketplaces and local platforms sell non-guaranteed reach to small local businesses (as of Sept 2026)

Scope: Uber Eats, DoorDash, Rappi (LatAm), Yelp, Google Local Services Ads / Maps promoted pins, and Meta. Instacart is NOT covered (no time budget left; see Gaps). Confidence tags: [H] = official/primary source that I fetched; [M] = reputable trade press or primary source seen only via a search snippet; [L] = aggregator/agency blog or dated/secondhand source. Several official merchant pages (DoorDash help/merchants, Restaurant Business) returned HTTP 403 to the fetcher. Where that happened, the claim is tagged by the search snippet and marked "not fetched".

## 1. Pricing units and typical minimums for a small restaurant/cafe

### Takeaway
Pricing splits into three families. Uber Eats, Rappi, Yelp and Google Maps charge per click (CPC). DoorDash charges per order (a CPA taken in a second-price auction). Google LSA charges per lead. Every platform lets the merchant set the budget, and most set very low floors (about US$5/day on Yelp and Meta, a few dollars a week on Uber Eats). The price of a unit is set dynamically by the auction or by demand, and no platform publishes fixed rates. Ads are always charged on top of the base marketplace commission.

### Cited Findings
- **Uber Eats Sponsored Listings.** Pricing is cost-per-click: the restaurant pays only when a user taps the listing, which appears at the top of the home feed. Merchants set a weekly budget and choose how much to pay per click. Some restaurants spend "as little as a few dollars a week", and independents average about US$50/week. These are launch-era figures (2020). [M, snippet, not fetched] — [Restaurant Business](https://www.restaurantbusinessonline.com/marketing/uber-eats-launches-sponsored-listings); [Marketing Dive](https://www.marketingdive.com/news/uber-eats-unveils-first-ad-format-with-sponsored-restaurant-listings/584394/)
- The official Uber FAQ confirms merchants can "make edits to budget and bids" and see ad spend in their statements. It does NOT publish a minimum budget or a CPC range. [H] — [Uber Help, Sponsored Listings FAQ](https://help.uber.com/en/merchants-and-restaurants/article/sponsored-listings-faq?nodeId=ad985cec-625e-4951-afac-18926088be6a)
- **DoorDash Sponsored Listings.** Pricing is a second-price cost-per-acquisition: the merchant pays only when a customer orders after clicking the ad. The bid is the maximum the merchant will pay per order, and the winner pays the minimum needed to win. Merchants can set a custom bid or use "Automatic Bidding". Orders placed within 7 days of the click are charged. Select merchants get a US$100 credit per store to try it. No public minimum bid was found. [M, snippet of official pages that returned 403 on fetch] — [DoorDash Merchants, Sponsored Listings](https://merchants.doordash.com/en-us/products/sponsored-listings); [DoorDash Help, self-serve Sponsored Listing](https://help.doordash.com/en-us/merchants/article/getting-started-with-self-serve-sponsored-listing)
- **Rappi Ads (9 countries: MX, AR, BR, CL, CO, CR, EC, PE, UY).**
  - Model: "Costo por Clic" (CPC). The merchant pays for each customer who enters the store in the app. [M, snippet] — [Rappi Ads, Colombia](https://merchants.rappi.com/es-co/ads)
  - Click price: "the value of your click depends on each zone and time of day", so zones and hours with higher demand cost more. Rappi's algorithm sets the per-click value, and the charge is clicks × click value. If Rappi does not deliver all the clicks, the merchant is charged only for the ones delivered. [M, snippet] — [Rappi Ads FAQ](https://www.rappiads.rappi.com/faq) (connection refused on fetch)
  - The official Mexico merchant page, which I fetched, publishes no CPC rates or minimum budget. It says the merchant "can choose how much to invest", that some campaigns may be co-financed with Rappi, and that budget "suele consumirse por impresiones (CPM)" ("is usually spent on impressions (CPM)"). **This contradicts the pure-CPC wording of the other Rappi pages.** Both models probably coexist, for example CPM for brand/display and CPC for restaurant listings. That split is unverified. [H] — [Rappi Merchants MX](https://merchants.rappi.com/es-mx/que-es-un-clic-en-una-campana-de-rappi-partners)
- **Yelp Ads.** Pay-per-click, with a daily budget "as little as $5 per day". Yelp does not publish its own average CPC. [H] — [Yelp for Business, ad cost](https://business.yelp.com/resources/articles/ad-cost/?domain=local-business). Third-party figures: at least US$150/month, most local service businesses spend US$300–1,500/month, and CPCs run from a few dollars up to US$15+ in plumbing/HVAC/legal. [L] — [WebFX](https://www.webfx.com/blog/ppc/yelp-advertising-costs/)
- **Google Local Services Ads.** The merchant pays per lead. "Your bid is the maximum amount you're willing to pay for a lead." [H] — [Google LSA Help, About ad rankings](https://support.google.com/localservices/answer/7527305?hl=en). LSA targets home and professional services, not restaurants.
- **Google Maps promoted pins / local search ads.** Charged by views or clicks depending on the campaign type. Formats are promoted pins, Maps search ads and Map suggest ads. [M] — [Google Ads Help, local search ads on Maps](https://support.google.com/google-ads/answer/7040605?hl=en). Typical local CPC is about US$2–6. [L] — [myleadsfactory](https://myleadsfactory.com/blog/google-maps-ads-guide)
- **Meta.**
  - Meta recommends at least US$5 of budget and a run of more than six days so its learning system can optimize. It may overspend a daily budget by up to 75%, but weekly spend stays capped at 7× the daily budget. [H] — [Meta for Business, Ads pricing](https://www.facebook.com/business/ads/pricing)
  - Third parties cite technical floors of about US$1/day for awareness and about US$5/day for clicks. [L] — [Stackmatix](https://www.stackmatix.com/blog/meta-ads-minimum-daily-budget-2026)
- **Ads sit on top of commission.** Delivery commissions are about 12–35% per order, and promoted listings are charged in addition. [L] — [Restolabs](https://www.restolabs.com/blog/how-food-delivery-apps-are-killing-your-restaurant-business)
- **Rappi commissions in Mexico** are covered by a vendor guide, which I did not fetch. [L] — [PoloTab](https://www.polotab.com/blog/cuanto-cobra-rappi-a-los-restaurantes-guia-2025-mexico)

### Inferences
- Across these platforms, the unit is chosen to push risk onto the platform in proportion to how much the platform controls the funnel:
  - DoorDash owns checkout, so it can charge per order.
  - Uber Eats, Rappi and Yelp charge per click.
  - Google LSA charges per lead (a call or message).
  - Rappi's "you only pay for the clicks delivered" is the explicit form of this: a budget ceiling, not a delivery promise.
- For a network of small cafes, the pattern that recurs is a self-serve weekly or daily budget with a very low floor (a few dollars) plus a demand-based unit price (zone × hour on Rappi).

### Gaps
- No official CPC ranges for Uber Eats or Rappi, no minimum DoorDash bid, and no ARS/MXN/COP figures were found. Rappi says the price is set per zone and hour by its algorithm.
- The Uber Eats "~US$50/week" figure is from 2020 and has not been refreshed.

## 2. Allocation / ranking and limits on sponsored slots

### Takeaway
Every platform ranks ads with an auction that multiplies the bid by a quality or relevance signal, and none sells position on bid alone. Google LSA states this most explicitly: a higher-quality profile can outrank a higher bidder and pay less. The number of slots is deliberately capped. The best-documented cap is DoorDash in 2021: one paid ad at the top of restaurant search results, two in grocery and convenience.

### Cited Findings
- **DoorDash.** Each search ranks eligible ads "based on bid and quality scores", and the restaurant with the highest score wins. Only one paid ad is shown at the top of restaurant search results, and two in convenience/grocery, so that users are not overwhelmed. [M, secondhand: a Cornell course blog citing WSJ, "DoorDash Introduces Search Page Ads for Restaurants", 2021-10-13, which I did not fetch; the limit may have changed since] — [Cornell INFO 2040 blog](https://blogs.cornell.edu/info2040/2021/11/06/the-growth-of-doordash-advertising-with-sponsored-search/)
- DoorDash placement depends on "factors such as your bid and campaign setup". [M, snippet] — [DoorDash Help](https://help.doordash.com/en-us/merchants/article/getting-started-with-self-serve-sponsored-listing)
- **Google LSA.**
  - The ranking auction considers the bid and "how likely your ad is to result in a lead". That likelihood depends on responsiveness (missed calls hurt), the search context, and profile quality: rating, number of reviews, response time, photos and verification.
  - A business with several locations serving the same area shows "only the highest ranking ad".
  - Higher-quality profiles may rank higher and also pay less per lead.
  [H] — [Google LSA Help](https://support.google.com/localservices/answer/7527305?hl=en)
- Agency claims about LSA: accounts that answer at least 95% of leads within 5 minutes rank much higher, and accounts rated 4.7+ can outrank higher bidders. [L, unverified] — [Boomcycle](https://boomcycle.com/blog/google-local-service-ads-ranking-factors/)
- **Rappi.**
  - Access requires meeting "ciertos criterios de calidad y servicio" ("certain quality and service criteria"). [H] — [Rappi Merchants MX](https://merchants.rappi.com/es-mx/que-es-un-clic-en-una-campana-de-rappi-partners)
  - Ads rotate dynamically across favorites, restaurant listings, category rankings and search. [M] — [Marketing4eCommerce MX, 2023-12-04](https://marketing4ecommerce.mx/rappi-ads-solucion-de-retail-media-de-la-app-de-delivery-genero-2-5-mdd-de-ganancias-en-mexico/)
- **Uber Eats.**
  - Targeting uses the customer's location, order history and dietary preferences. [M, snippet] — [Restaurant Business](https://www.restaurantbusinessonline.com/marketing/uber-eats-launches-sponsored-listings)
  - The official FAQ does not disclose the ranking formula or the number of slots. [H] — [Uber Help](https://help.uber.com/en/merchants-and-restaurants/article/sponsored-listings-faq?nodeId=ad985cec-625e-4951-afac-18926088be6a)
- **Yelp.** Ads appear "above or below relevant search results" in the "Sponsored Results" sections and on competitors' pages. The ranking algorithm is not disclosed. [H] — [Yelp for Business](https://business.yelp.com/resources/articles/ad-cost/?domain=local-business)

### Inferences
- The shared pattern is effective rank = bid × P(conversion | user, context) × a quality term, plus a hard cap on sponsored slots per surface. The quality term uses signals the platform can observe: responsiveness, ratings, and the store's conversion rate.
- For a shared-audience network, the Google LSA-style mechanism fits best. Operational quality lowers the price and raises the rank, which aligns merchant incentives with the user experience. The slot cap protects the user regardless of how much is bid.

### Gaps
- Current (2026) slot counts for DoorDash and Uber Eats are not publicly documented. The DoorDash "1 slot" figure dates from 2021.
- I did not fetch Meta's official auction formula (bid × estimated action rate × ad quality). The pricing page I fetched does not describe it.

## 3. Push notifications on behalf of merchants and frequency governance

### Takeaway
Only Uber publishes how it governs marketing push, including restaurant promotions. It uses a central optimizer with per-user daily caps and minimum spacing between pushes. When there are more candidate pushes than capacity, it sends the most valuable ones and drops the rest. I found no evidence that Uber Eats, DoorDash or Rappi sell merchants direct push slots in the aggregator app. A merchant's promotion may end up in a platform push, but the platform decides.

### Cited Findings
- **Uber Eats push volume and governance.**
  - Marketing push started in March 2020 and grew to "billions of notifications per month" by the end of 2020.
  - The optimizer uses linear programming with a "daily frequency cap (e.g., at most 2 pushes per day)" and a "minimum time difference between push notifications (e.g., 8 hours)".
  - Candidate pushes are scored with an XGBoost conversion model. When volume exceeds capacity, "the most valuable pushes will be assigned... and the remaining ones will be dropped".
  - The constraints include promotion expiry, send windows and restaurant opening hours, so merchant promotions are part of the push content.
  - Caveat: the caps are given as examples ("e.g."). The blog does not guarantee they are the production values.
  [H] — [Uber Engineering blog, 2022-11-03](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/)
- **DoorDash.** Branded push notifications are offered through the restaurant's own branded app (DoorDash Storefront/Pro package), not through the DoorDash consumer app. [M, snippet] — [DoorDash Merchants blog, restaurant text marketing](https://merchants.doordash.com/en-us/blog/restaurant-text-marketing)
- **DoorDash "Boosted Promotions"** exist, but the page returned 403. How they are placed (carousels, email, push) is unverified. — [DoorDash Learning Center](https://merchants.doordash.com/en-us/learning-center/restaurant-marketing-boosted-promotions)
- **Users** can turn Uber push preferences on or off in the app or in phone settings. [M] — [Uber Help, notification settings](https://help.uber.com/en/riders/article/changing-push-notification-settings?nodeId=80305412-9928-4be0-839c-c78ee789b3ff)

### Inferences
- A push budget per user (N per day with a minimum gap) is a common resource that merchants compete for. Uber allocates it by expected value, not by payment.
- The design lesson for a network of merchants sharing one pass or app: the platform owns the per-user attention budget, and merchants buy eligibility or priority inside it, never guaranteed delivery.

### Gaps
- No official document says whether Rappi or DoorDash let merchants pay for push in the consumer app, or what the per-user caps are. No LatAm source on push governance was found.

## 4. Reporting to small merchants (no guarantee of delivery)

### Takeaway
Small merchants see spend, clicks and orders, and sometimes ROAS or new customers. No platform promises volume. DoorDash is the only one with documented incrementality measurement (Ghost Ads).

### Cited Findings
- **Uber Eats** reports orders placed through the Sponsored Listing, total clicks and ad spend, with a 48-hour data lag. No guarantees are stated. [H] — [Uber Help FAQ](https://help.uber.com/en/merchants-and-restaurants/article/sponsored-listings-faq?nodeId=ad985cec-625e-4951-afac-18926088be6a)
- **DoorDash** uses "Ghost Ads" as its standard incrementality method for Sponsored Listings. The experiment includes only users who saw the ad or would have seen it. In 8 large tests it cut measurement noise by more than 90% and showed higher incremental lift than earlier measurement. [M, snippet; the page returned 403] — [DoorDash Ads, Ghost Ads](https://advertising.doordash.com/en-us/resources/measuring-incrementality-with-ghost-ads-at-doordash)
- **DoorDash attribution window:** orders within 7 days of the click. [M] — [DoorDash Merchants](https://merchants.doordash.com/en-us/products/sponsored-listings)
- **Rappi** offers "métricas en tiempo real" ("real-time metrics") and analytics tools covering sales, interaction and ROI. It states no guarantees. [H] — [Rappi Merchants MX](https://merchants.rappi.com/es-mx/que-es-un-clic-en-una-campana-de-rappi-partners)
- **Rappi's no-guarantee wording:** if clicks are not delivered, the merchant pays only for those received. [M] — [Rappi Ads FAQ](https://www.rappiads.rappi.com/faq)
- **Yelp** provides a dashboard and lets merchants pause or cancel at any time. No click guarantee is mentioned on this page. [H] — [Yelp for Business](https://business.yelp.com/resources/articles/ad-cost/?domain=local-business)
- **Google LSA:** "We're always running experiments…" and no delivery guarantee. [H] — [Google LSA Help](https://support.google.com/localservices/answer/7527305?hl=en)

### Inferences
- The standard contract is: the merchant sets a budget ceiling, is billed only on the realized unit (click, order or lead), and gets reporting after the fact. That is how these platforms sell reach without promising it.
- Incrementality is a large-platform capability (DoorDash). Small merchants mostly see attributed, non-incremental numbers, which tend to overstate ROI.

## 5. Evidence of small-merchant ROI and complaints

### Takeaway
Platform-published ROI claims are strong: US$5 revenue per US$1 on Uber Eats at launch, and "96% increased clicks up to 4×" on Rappi. These figures are attributed, not incremental, and self-reported. Independent evidence consists mostly of complaints: costs stack on top of commission, pay-to-play dependency, and on Yelp, billing and sales-practice grievances. Ads are now material revenue for the platforms (DoorDash about US$1B run-rate, Uber over US$1.5–2B), which raises the pressure on merchants to spend.

### Cited Findings
- **Uber Eats** early tests: US$5 of revenue per US$1 of ad spend. Self-reported, 2020. [M, snippet] — [Restaurant Business](https://www.restaurantbusinessonline.com/marketing/uber-eats-launches-sponsored-listings)
- **Rappi** claims: 96% of restaurants using RappiAds grew clicks up to 4×, and 76% grew new-user visits up to 4×. Self-reported, with "up to" framing. [M] — [Rappi Ads Colombia](https://merchants.rappi.com/es-co/ads)
- **Rappi Mexico (2023-12-04):**
  - 4,000+ deals, 1,700 campaigns and about US$2.5M in attributed sales since January 2022. The target is restaurant SMEs.
  - **Conflict on impressions:** the fetched article says "450,000+" impressions, while the search snippet says 450,000,000.
  [M] — [Marketing4eCommerce MX](https://marketing4ecommerce.mx/rappi-ads-solucion-de-retail-media-de-la-app-de-delivery-genero-2-5-mdd-de-ganancias-en-mexico/)
- **La República (Colombia, 2023-12-11):** RappiAds "representa 50% de los ingresos de la empresa" ("represents 50% of the company's revenue"). Other figures: about 420 brands and 4,500+ deals in Colombia, 410M impressions, and an expected US$80M revenue increase. **Low confidence on the 50% figure.** It is extraordinary, unaudited (Rappi is private), and may be a misquote. [L/M] — [La República](https://www.larepublica.co/empresas/rappiads-la-apuesta-a-la-publicidad-de-rappi-3765502)
- **DoorDash** advertising reached about a US$1B annualized run-rate (Q3 2025 call), and ads are raising net revenue margin. [M] — [Motley Fool Q3 2025 transcript](https://www.fool.com/earnings/call-transcripts/2025/11/27/doordash-dash-q3-2025-earnings-call-transcript/); [DoorDash 10-Q Q3 2025](https://www.sec.gov/Archives/edgar/data/1792789/000179278925000020/dash-20250930.htm)
- **Uber Ads** passed a US$1.5B run-rate in May 2025 (+60% YoY), and later reports put it above US$2B. [M] — [Motley Fool](https://www.fool.com/investing/2025/07/24/uber-ads-the-hidden-gem-powering-ubers-next-growth/); [Dealroom](https://app.dealroom.co/news/feed/uber-s-advertising-business-surpasses-2b-revenue-run-rate-exceeding-earlier-2-penetration-cap)
- **Complaints: stacking and pay-to-play.**
  - Operators end up "paying 15% for ads plus 25% commission". Organic visibility declines, which pushes more ad spend. [L, vendor blog] — [OPA! blog](https://opalink.com/blog/the-hidden-cost-of-doordash-advertising-how-restaurant-ad-spend-now-exceeds-delivery-commissions); [Restolabs](https://www.restolabs.com/blog/how-food-delivery-apps-are-killing-your-restaurant-business)
  - Trade press reports that third-party delivery hurts restaurant economics in general. [M, not fetched] — [Restaurant Business](https://www.restaurantbusinessonline.com/financing/third-party-delivery-hurting-restaurant-economics)
- **Yelp complaints:** FOIA-obtained complaints allege misleading billing, "free" trials that convert to charges, and aggressive telemarketing. Yelp's BBB average is 1 star. [L/M, short-seller newsletter plus BBB] — [The Bear Cave](https://thebearcave.substack.com/p/more-problems-at-yelp-yelp); [BBB](https://www.bbb.org/us/ca/san-francisco/profile/internet-service/yelp-inc-1116-193927/complaints?page=2)

### Inferences
- The main risks for a small merchant are attributed ROI numbers that are not incremental, an escalating pay-to-play loop, and opaque billing. A trustworthy design would show incremental or holdout results, cap spend explicitly, and avoid auto-renewing trials.

### Gaps
- I found no independent, peer-reviewed incrementality study for small restaurants on Uber Eats or Rappi.
- **Instacart** was not researched.
- No Argentina-specific data on Rappi Ads pricing or results was found. PedidosYa Ads, the other big LatAm player, was not covered and is worth a follow-up.
