# Pay-for-performance models for local merchants (Groupon, card-linked offers, cashback networks, LatAm reintegros)

Research date: 2026-09-29. ~15 tool calls. Confidence labels: [ALTA] = primary source (filing, company page) read directly; [MEDIA] = secondary/trade press or company marketing claim; [BAJA] = search snippet / aggregator, not verified against a primary source.

## Groupon: how it charges, merchant problems, state 2025-2026

### Takeaway
Groupon charges no upfront fee and takes a commission only on each voucher sold or redeemed. Groupon's own merchant page now shows 20-40%, not the "50% of the discounted price" of the 2010s. The academic evidence from the boom (2010-2014) shows the economics were marginal: about a third of merchants lost money, few deal customers came back at full price, and restaurants did worst. Groupon survives in 2025-2026 as a smaller "local experiences" marketplace that has returned to modest growth.

### Cited Findings
- Groupon charges "no upfront fees". It takes a commission "on each redeemed voucher, at a rate agreed before your campaign launches", and there is no universal percentage. Its examples use 20%, 30% and 40% (so the merchant keeps $40/$35/$30 of a $50 voucher). There are no listing fees and no charges per impression or click. Payments are processed weekly on Wednesdays (ACH arrives 3-5 business days later). "Promotional Adjustments cap at 20%" when Groupon features a deal. [ALTA, company page, fetched 2026-09] — [Groupon Merchant pricing](https://www.groupon.com/merchant/pricing)
- Groupon itself calls it a "myth" that it requires a 50% discount and then takes half of what is left. It says rates are flexible. [ALTA as Groupon's claim] — [Groupon Merchant pricing](https://www.groupon.com/merchant/pricing)
- Historical structure: 50% discount + ~50% commission meant the merchant got ~25% of face value, and restaurants often sold meals below cost. Unlimited quantities brought "huge influxes of unprofitable new customers". [MEDIA, HBS student case, undated ~2015] — [Harvard D3 "Groupon: A Good Deal for Anyone?"](https://d3.harvard.edu/platform-rctom/?p=20745)
- Dholakia survey of 150 businesses that ran Groupon deals (June 2009 to Aug 2010): 66% profitable, 32% unprofitable. Merchants with unprofitable deals reported less spending beyond the voucher's face value (25% vs 50%) and fewer customers returning to buy at full price (13% vs 31%). [ALTA for the paper's existence; figures via search snippet, MEDIA] — [SSRN 1696327](https://ssrn.com/abstract=1696327); [SSRN 1790414](https://ssrn.com/abstract=1790414.)
- Dholakia also estimated that only ~4% of Groupon customers repurchased at full price in the first two weeks after redeeming. Those who did return spent more than an average customer. Deal commissions ran 20-50% and discounts up to 90%. [MEDIA, snippet of research summary] — [ResearchGate "A Startup's Experience with Running a Groupon Promotion"](https://www.researchgate.net/publication/228150104_A_Startup's_Experience_with_Running_a_Groupon_Promotion)
- Related academic work: Edelman, Jaffe & Kominers, "To Groupon or not to Groupon: The profitability of deep discounts" (Marketing Letters, 2014). It models when deep discounts pay: mainly for price discrimination and for reaching customers who would not otherwise come. I did not re-read the conclusions in this session. [MEDIA] — [Springer](https://link.springer.com/article/10.1007/s11002-014-9289-y); [PDF](https://www.benedelman.org/publications/groupon-2014-03-01.pdf)
- "Does a Daily Deal Promotion Signal a Distressed Business?" is an empirical paper on how small businesses survive after daily deals. I saw only the title and did not read the results. — [arXiv 1211.1694](https://arxiv.org/pdf/1211.1694)
- FY2025 (10-K): revenue comes from "commissions by selling goods or services on behalf of third-party merchants". The stated strategy is to be "the trusted local experience marketplace", and ~84% of transactions were on mobile. [ALTA] — [Groupon 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1490281/000162828026016429/grpn-20251231.htm)
- FY2025 results: global billings +7% to ~$1.76B; 16.2M active customers; NA local active customers +12%; local ≈90% of billings; first return to billings and revenue growth "in a decade"; ~$296M cash; 2026 guidance of +3-5%. [MEDIA, Yahoo Finance summary of the press release; primary release linked but not read directly] — [Yahoo Finance Q4 call highlights](https://finance.yahoo.com/news/groupon-q4-earnings-call-highlights-133656077.html); [Groupon IR release](https://investor.groupon.com/press-releases/press-release-details/2026/Groupon-Reports-Fourth-Quarter-and-Fiscal-Year-2025-Results/default.aspx)

### Inferences
- Groupon's model is "pay per sale", not "pay per incremental sale". The merchant pays commission and the discount even on customers who would have come anyway. Nothing separates new customers from existing ones, which is the structural reason for the "discount hunter" problem.
- 16.2M active customers (vs. a peak of 50M+ in the early 2010s, from memory and not verified this session) shows how far it has shrunk. The model survives, but in a niche.

### Gaps
- No current (2025-2026) independent data on repeat rates or merchant ROI. All the solid evidence is from 2010-2014.
- Groupon's aggregate take rate (revenue/billings) was not extracted from the 10-K.

## Card-linked offers (Cardlytics, Figg, Dosh, Drop, Ibotta): charging, targeting, closures

### Takeaway
In a card-linked offer (CLO), the merchant funds a reward (e.g. 10% cash back) and pays only on purchases matched to an enrolled card. That incentive is split between the CLO platform, the bank/publisher and the consumer. Targeting "new vs existing" customers works because the bank holds each cardholder's purchase history, so an offer can be shown only to people with no recent spend at that merchant. The sector is shrinking: Cardlytics is losing billings and bank partners, and Dosh (owned by Cardlytics) closed its consumer app in February 2025.

### Cited Findings
- Economics of a CLO: the merchant pays a discount (e.g. 10% back), the CLO provider takes a cut, the bank takes a cut, and the rest reaches the cardholder (e.g. of 10%, 5% to the platform and 5% to the consumer). [BAJA, blog, illustrative example] — [CardsFTW "Card-Linked Offers: How They Work, Who Pays"](https://www.cardsftw.com/cardsftw-141-card-linked-offers-how-they-work-who-pays-and-why-they-exist-2/)
- Figg (Augeo + Empyr merger): the merchant pays Figg only when a transaction happens. It is billed incentive + fees monthly on actual redemptions. [BAJA, snippet] — [Nilson Report on Figg](https://nilsonreport.com/articles/figgs-card-linked-offers-for-issuers-and-publishers/); [Figg Master T&C](https://www.gofigg.com/mastertc/)
- Cardlytics FY2025: revenue $233.3M (−16.2%), billings $385.0M (−13.3%), partner share and third-party costs $102.9M, consumer incentives $151.7M, net loss $(103.5)M, adjusted EBITDA $10.1M. MQUs rose to 224.2M while ACPU fell 25% to $0.50. Bank of America campaigns ended in January 2026. Q1 2026 billings guidance is $57.5-63.5M, down 35-41% YoY. [ALTA, IR press release] — [Cardlytics FY2025 results](https://ir.cardlytics.com/news/news-details/2026/Cardlytics-Announces-Fourth-Quarter-and-Full-Year-2025-Financial-Results/default.aspx)
- Cardlytics targeting: it uses the partner banks' anonymized transaction data (~$5.7T in purchases analyzed in 2025). It can target, for example, customers who "shop online but rarely visit physical stores". Revenue share with banks was raised in June 2023 and amended again in July 2025. [MEDIA, search summary of the 10-K] — [Cardlytics 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1666071/000166607126000010/cdlx-20251231.htm)
- Dosh: the consumer app shut down on 2025-02-28 and Dosh Holdings LLC was dissolved on 2025-11-13 (per Cardlytics). Cardlytics (which bought Dosh in 2021) kept the ad technology and retired the consumer product. No official reason was given. Commentators cite a lack of compelling offers. Minimum withdrawal was cut from $15 to $0.01 for the closure. [MEDIA, consumer blogs; the reason is UNVERIFIED speculation] — [Doctor of Credit](https://www.doctorofcredit.com/dosh-app-shutting-down/); [Frequent Miler](https://frequentmiler.com/theres-a-dosh-kibosh-card-linked-app-is-shutting-down-withdraw-cash-asap/); [The Ways to Wealth](https://www.thewaystowealth.com/dosh-review/)

### Inferences
- Cardlytics' collapsing billings and loss of a major bank (BofA) suggest the CLO-via-bank model has trouble keeping publishers and advertisers. The value is captured by whoever controls the payment channel. That is relevant for LatAm, where banks and wallets are the channel.
- "Pay only on attributed spend" ≠ "pay only on incremental spend". Cardlytics-style CLOs charge on every matched purchase by a targeted user. Incrementality is claimed through targeting (lapsed/new customers) and lift studies, not through billing.

### Gaps
- Drop and Ibotta (local/restaurant offers): not researched in this session. No sourced data.
- Cardlytics' exact current pricing model (CPS vs. engagement-based) was not confirmed. The press release does not discuss it.
- No sourced data on CLO fraud/abuse (card churning, fake transactions).

## Upside: "pay only for incremental profit"

### Takeaway
Upside is the purest incrementality model in the US: a profit share on incremental profit only. Each claiming user is compared against a matched control group of similar non-users, and the merchant pays only on the measured difference. Offers are "margin-bound" so the merchant stays profitable. The claimed results come from Upside's own marketing and have no independent audit.

### Cited Findings
- Method: after a user claims an offer, Upside matches them with "10 to 100 non-Upside users with similar purchasing histories". The spend difference is "deemed incremental and attributed to Upside". Existing promos, loyalty programs, weather, competition and inflation are adjusted for. [ALTA as a description of method; company source] — [Upside measurement methodology](https://www.upside.com/business/how-it-works/measurement-methodology)
- Pricing: a "profit-share cost model". Retailers "only pay when results are proven to be incremental and net-new", with no transaction fees or ROAS-based pricing. [ALTA, company] — [Upside measurement methodology](https://www.upside.com/business/how-it-works/measurement-methodology); [Upside retailer FAQs](https://www.upside.com/business/faqs)
- Verticals: fuel & convenience, grocery, restaurants (corporate and franchise). [ALTA] — [Upside measurement methodology](https://www.upside.com/business/how-it-works/measurement-methodology)
- Claimed results: "COEN" (fuel/convenience chain) reports $2.4M in verified incremental sales in year 1, with 85% of those customers new or infrequent. Giant Eagle and Schnucks report "3% better YoY sales". [MEDIA, company testimonial, unaudited] — [Upside measurement methodology](https://www.upside.com/business/how-it-works/measurement-methodology)
- Consumer rewards typically run 5-25¢/gallon on gas, 5-15% at grocery and up to 35% at restaurants. Upside says it paid $245M in cash back in 2024 and generated $605M in incremental profit for partners. [BAJA, secondary sources repeating company figures] — [Motley Fool "How does Upside make money"](https://www.fool.com/investing/how-to-invest/stocks/how-does-upside-make-money/); [The Ways to Wealth Upside review 2026](https://www.thewaystowealth.com/upside-review/)
- Restaurants, small-business example: Dunn Brothers Coffee (a franchise) gained "63 new customers" in 5 months. The 2022 post gives no profit split or eligibility rules. [MEDIA, company blog, 2022-06-06] — [Upside for Restaurants blog](https://www.upside.com/blog/upside-for-restaurants-is-it-too-good-to-be-true)

### Inferences
- Of all the models, Upside's aligns incentives best on paper. But it depends on (a) seeing the customer's history before and after (card data), and (b) a large pool of non-users for the control group. That is feasible for chains, and harder for one café with a handful of transactions a day, where control-group variance is huge.
- The merchant has to trust a methodology run by the vendor itself (Upside measures what it charges for). It is an information asymmetry, not an independent audit.

### Gaps
- The exact profit-share percentage is not published anywhere I found.
- I found no independent critique or third-party audit of Upside's incrementality.
- Whether a single independent café can join, and how it performs there, is not documented.

## Rewards Network (restaurant marketing funded by advances / dining credits)

### Takeaway
Rewards Network runs the dining programs of airlines and hotels. Restaurants either (a) pay only when program members dine, or (b) take cash upfront in exchange for future food-and-beverage credits, repaid as members "dine down" the balance. That second product works like a merchant cash advance.

### Cited Findings
- The marketing product: "Restaurants pay nothing unless members spend". Members earn miles/points, which Rewards Network buys from the loyalty programs. [MEDIA, View from the Wing, 2026-05-10] — [View from the Wing](https://viewfromthewing.com/one-company-runs-every-airline-and-hotel-dining-program-heres-how-it-works/)
- The funding product: Rewards Network "prepurchases food and beverage on behalf of future members and gives the restaurant upfront capital". Historically, a $10,000 advance bought ~$20,000 in F&B credits, recovered over 6-8 months (a 2:1 ratio). This comes from the old Transmedia model, where consumers got 20-25% off. [MEDIA] — [View from the Wing](https://viewfromthewing.com/one-company-runs-every-airline-and-hotel-dining-program-heres-how-it-works/); [Rewards Network flexible funding](https://www.rewardsnetwork.com/program-benefits/flexible-funding-options/)
- "Premier Restaurant Funding": Rewards Network buys future card receivables and is repaid as a percentage of all card sales. [BAJA, snippet] — [Rewards Network how it works](https://www.rewardsnetwork.com/how-it-works/)
- Company claim: members can be 4-6% of sales and spend up to 24% more than other customers. There are no fixed monthly fees. [MEDIA, company claim] — [View from the Wing](https://viewfromthewing.com/one-company-runs-every-airline-and-hotel-dining-program-heres-how-it-works/); [Rewards Network](https://www.rewardsnetwork.com/)

### Inferences
- A 2:1 ratio means an implicit cost of capital of ~100% of the advance in 6-8 months. It is expensive financing wrapped up as marketing. The "pay per result" is partly an illusion: the merchant pays for the credits whether or not the diners are incremental.

### Gaps
- The current marketing-fee percentage is not found. View from the Wing notes it does not break down fees.

## Argentina/LatAm: bank and wallet promotions ("reintegros") funded by merchants

### Takeaway
In Argentina, bank and wallet promotions (MODO, Mercado Pago, Cuenta DNI) mix three funding schemes. Some are 100% merchant-funded ("sistémicas"), some are shared between bank and merchant, negotiated merchant by merchant, and some are 100% bank-funded (Cuenta DNI says it pays its own). The split is almost never disclosed publicly. It is not "pay per incremental result": the merchant funds the discount on every purchase made with that bank or wallet, new customer or not.

### Cited Findings
- Banco Hipotecario: "Hay promos sistémicas [que paga 100% el comercio] y hay de aporte compartido. Se hacen acuerdos comercio x comercio. Es complicado porque involucra varias partes." [MEDIA, newsletter quoting the bank, 2024-07-21] — [Lado B News "¿Quién paga los descuentos?"](https://www.ladobnews.com.ar/p/quien-paga-los-descuentos)
- Cuenta DNI (Banco Provincia) is the only one that answered clearly: benefits "surgen de los recursos y la rentabilidad del banco". MODO and most banks did not disclose who pays. [MEDIA] — [Lado B News](https://www.ladobnews.com.ar/p/quien-paga-los-descuentos)
- MODO example: 20% back on the gross amount at participating merchants, capped at $25,000 per bank per month, credited within 24-48 h. In the Mercado Pago + Carrefour joint promo (15%), "el descuento es a cargo de Carrefour", applied at the till. [BAJA, search snippets from promo pages] — [MODO promos](https://www.modo.com.ar/promos/disco-septiembre26); [El Cronista: Mercado Pago reintegros 20% barrio y Pyme](https://www.cronista.com/infotechnology/finanzas-digitales/descuentos-mercado-pago-ofrecen-reintegros-del-20-en-compras-de-barrio-y-pyme/)
- State-funded precedent: "Compre sin IVA" (2023) refunded 21% on debit-card purchases at retailers. This one was fiscal, not merchant-funded. [MEDIA] — [El Cronista, Compre sin IVA y Mercado Pago](https://www.cronista.com/infotechnology/actualidad/compre-sin-iva-mercado-pago-explico-como-usar-la-app-para-recibir-el-reintegro/)
- Payments context: in 2025 transfers were 65.6% of all National Payment System transactions. [BAJA, snippet] — [Noticias Las Flores, adherir comercio a promociones bancarias 2026](https://www.noticiaslasflores.com.ar/interes-general/como-adherir-mi-comercio-a-promociones-bancarias-en-2026/)

### Inferences
- Economically, the Argentine model looks more like classic trade marketing / co-op funding than pay-for-performance. The merchant subsidizes the bank's entire customer base on promo days, with no measure of new vs. existing customers. The bank or wallet captures the data and the relationship.
- For a small café, the natural entry point is the Mercado Pago/MODO "barrio y Pyme" promotions. I could not document who funds those or what they cost the merchant.

### Gaps
- No quantitative data on how Argentine SMEs value these promotions (surveys from CAME or similar business chambers were not found in this session).
- Merchant/bank split percentages are not disclosed publicly.
- Other LatAm markets (Brazil, Mexico) were not researched.

## Which model aligns incentives best for a small café; ROI evidence; fraud/abuse

### Takeaway
On paper, the order from best to worst incentive alignment is: incremental profit share (Upside) > pay per attributed sale targeted at new customers (CLO) > commission per voucher (Groupon) > merchant-funded bank discounts > advance/credits (Rewards Network, which is financing). In practice, the models that align best need card data and scale to measure incrementality, which a single café lacks. The only independent ROI evidence found is Groupon's, and it is old and mixed.

### Cited Findings
- Groupon (independent evidence): 66% profitable / 32% unprofitable (2009-2010 sample). The deciding factors were extra spend beyond the voucher and return visits at full price. [MEDIA] — [SSRN 1696327](https://ssrn.com/abstract=1696327)
- Upside (company evidence): merchants pay only on measured incremental profit, with offers bounded by margin. [ALTA as a claim] — [Upside measurement methodology](https://www.upside.com/business/how-it-works/measurement-methodology)
- The CLO sector is in decline (Cardlytics −13% billings in 2025, −35-41% guided for Q1 2026; Dosh closed). [ALTA] — [Cardlytics FY2025](https://ir.cardlytics.com/news/news-details/2026/Cardlytics-Announces-Fourth-Quarter-and-Full-Year-2025-Financial-Results/default.aspx); [Doctor of Credit](https://www.doctorofcredit.com/dosh-app-shutting-down/)

### Inferences
- The failure pattern repeats. Groupon's boom-era model (deep discount + high commission, no new-customer filter) and Dosh (a consumer app without enough attractive offers, i.e. a failed two-sided marketplace) both failed to generate enough value for both sides at once. Cardlytics depends on banks that can walk away.
- For a small café, the most defensible lesson: charge only on customers verifiably new to that café (first visit), measured with the café's own data, not a control group. That is simple, auditable and hard to game, though it still cannot tell "new because of the network" from "would have come anyway".

### Gaps
- **Fraud/abuse**: I found no sourced material on fraud in CLOs, cashback or reintegros (fake transactions, self-referrals, split receipts) in this session. This is an open gap.
- No independent ROI evidence for CLOs or Upside at independent cafés.
- Drop, Ibotta Local and local cashback networks in LatAm were not researched.
