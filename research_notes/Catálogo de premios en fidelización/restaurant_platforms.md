# Restaurant/café/SMB loyalty + marketing platforms: reward library vs inline campaign offers

Scope: Square, Toast, Thanx, Punchh (PAR), Paytronix, Loyverse, Stamp Me, and partly Clover. Belly and Lightspeed were not researched (see Gaps). About 30 tool calls. support.punchh.com failed with a TLS certificate error, so the Punchh notes rely on PAR developer and product docs.

## Q1. Where is a campaign reward defined (inline or chosen from a library), and is it the same entity as the points/stamp reward?

### Takeaway
The enterprise restaurant platforms (Punchh, Thanx, Paytronix) all use one shared reward definition entity. Punchh calls it the "redeemable", Thanx the "reward template" and Paytronix the "wallet code". The loyalty program and campaigns both reference it, and a per-guest reward instance is issued from it. The SMB POS suites (Square, Toast) split things. Loyalty rewards are defined inside the loyalty program as tiers. Marketing offers are separate coupon or discount objects, created in a marketing "Coupons" or "Discounts/Offers" area and then attached to a campaign. So even the SMB tools do not define offers truly inline in the email. They are also not the same entity as loyalty rewards.

### Cited Findings
**Punchh (PAR)**
- "The basic building block for an offer is the redeemable." Redeemables cover free item, discount/promotional price, BOGO, Buy X Get Y, and are "configured within the Punchh platform and are available across your entire business." — [PAR: Punchh Offers and Program Types](https://developers.partech.com/docs/dev-portal-developer-resources/punchh-offers-and-program-types)
- "Offers" is the umbrella term for coupons, rewards unlocked at a points threshold, completed visit cards and campaign results. "Rewards" are per-guest instances of redeemables, "provided to guests through campaigns, support gifting, or through the Points Convert to Rewards program type." — [same](https://developers.partech.com/docs/dev-portal-developer-resources/punchh-offers-and-program-types)
- Program types reuse the same redeemables. "Points Unlock Redeemables" lets guests pick which redeemable to unlock. "Points Convert to Rewards" grants rewards automatically at thresholds. — [same](https://developers.partech.com/docs/dev-portal-developer-resources/punchh-offers-and-program-types)
- The redeemable entity carries `points_required_to_redeem`, `applicable_as_loyalty_redemption`, `discount_amount`, `discount_channel` (online_only/offline_only/all), `expiry_date`, `expiry_days` ("Number of days after which the redeemable will expire once the user receives it"), `redemption_expiry`, `status` (activated/deactivated/draft/expired), `redeemable_properties` (e.g. "Food Item") and `meta_data`. The same object therefore serves loyalty and non-loyalty use. — [PAR webhook: Event - Redeemables](https://developers.partech.com/docs/dev-portal-webhooks-manager/events/redeemables)
- Coupon campaigns are hybrid. App-unlocked coupons use "Gift Type between Gift Points or Gift Redeemable" and "Select the redeemable you want to associate with this offer", so the campaign picks from the library. POS-processed coupons define the discount inline: "Gift Type between $ OFF or % OFF" with an amount or percent value. — [PAR product docs: Coupon Campaign](https://product-docs.partech.com/docs/punchh/files/product-features/Coupon-Campaign)
- Punchh's own help-center titles show that redeemables are created and then added to loyalty goals or programs: "How to add a new redeemable to loyalty goals?" and "How do I create a new redeemable in a Points Unlock Offers program?" These were seen in search results only; the fetch failed on TLS. — [support.punchh.com](https://support.punchh.com/s/article/How-to-add-a-new-redeemable-to-loyalty-goals-applies-to-Points-Unlock-Staged-Redeemables-earning-structure)

**Thanx**
- The Partner API has a separate `reward-templates` resource. "List Reward Templates: Returns published reward templates for a merchant." — [Thanx docs index](https://docs.thanx.com/llms.txt)
- Campaign creation references a template: "Treatment variants specify a reward_template_id that defines the reward to be issued." Control variants have no template. A campaign has 1 to 4 variants. — [Thanx: Create Campaign](https://docs.thanx.com/partner/campaigns/create-campaign.md)
- Template fields: `id`, `name`, `type`, `subtype`, `description`, `fine_print`, `discount` (hash with type and value), `redemption_venue`, `images`. — [Thanx: Get Reward Template](https://docs.thanx.com/partner/reward-templates/get-reward-template.md)
- Klaviyo's Thanx data reference exposes "Reward Template ID/Name", type/subtype, "name of the item" and "maximum value" on issued rewards. So issued rewards point back to a template. — [Klaviyo: Thanx data reference](https://help.klaviyo.com/hc/en-us/articles/19457831690139)
- Bonus points can be granted during "promotions, campaigns, or when a customer advances to a new tier". Rewards (the reward type includes points) are the common currency across loyalty and campaigns. — [Thanx: Reward overview](https://docs.thanx.com/consumer/rewards/overview.md)

**Paytronix**
- Rewards are organized by wallet codes: "A numeric identifier for a specific type of discount, unique for a given merchant." Campaigns deliver via `couponId` or wallet codes, and "all discounting eligibility and calculation logic lives within the Paytronix system". — [Paytronix Check Service](https://developers.paytronix.com/pxs_api_reference/check.html)

**Square**
- Loyalty reward tiers live in the loyalty program. Each tier defines "the number of points required and the value and scope of the discount". The scope can be the whole sale, a category, an item, or a free catalog item. — [Square Developer: Loyalty overview](https://developer.squareup.com/docs/loyalty/overview)
- Under the hood a tier holds a `pricing_rule_reference` (`object_id` + `catalog_version`) into the Square Catalog. So the loyalty discount is a catalog pricing-rule object, which is versioned. — [Square Developer: Loyalty rewards](https://developer.squareup.com/docs/loyalty-api/loyalty-rewards)
- Marketing coupons are separate. They are created at "Customers > Marketing > Coupons", and the fields are coupon code, coupon type, when it applies, and expiration. Square advises "coupon codes should be unique and not reused." — [Square: Create vanity code coupons](https://squareup.com/help/us/en/article/8485-create-vanity-code-coupons)
- Loyalty rewards and marketing coupons stack: a $10 loyalty reward plus a $10 birthday marketing coupon can both be redeemed. They are therefore distinct objects. — [Square Community](https://community.squareup.com/t5/Square-Loyalty/Loyalty-program-Customer-with-multiple-rewar/m-p/87446) (community source; search snippet)
- Both appear together in the Customer Directory profile under "Coupons and Rewards", where they can be viewed, voided and redeemed. — [Square: View and void loyalty rewards and coupons](https://squareup.com/help/us/en/article/6130-manage-your-square-loyalty-program)

**Toast**
- Loyalty rewards are defined in the Toast Loyalty program as up to four fixed tiers, either cash rewards or free-item rewards. "Both reward types can coexist in any combination, up to four tiers total." — [Toast Loyalty FAQ](https://support.toasttab.com/en/article/Toast-Loyalty-FAQ-1492794694913)
- The birthday reward is a Loyalty program setting, not a marketing object. If a guest hasn't reached a reward threshold, "the birthday discount will automatically be added as a discount to the order"; "The discount cannot exceed the guest's check total." — [Toast: Manage Birthday Rewards](https://support.toasttab.com/en/article/How-Birthday-Rewards-Work)
- Email marketing offers reference a POS discount created beforehand: "To add a promotion to your email template, you must create a discount with a promo code." The code is typed into the email and "promo codes can only be added to one-time email campaigns". — [Toast: Add a Promo Code to Your Email Marketing Campaign](https://support.toasttab.com/en/article/Adding-Promotions-to-a-Toast-Marketing-Campaign)
- A separate Offers Dashboard creates offers (fixed $/%, BOGO, spend-threshold/free item), with a single-use toggle, 30-day or no expiry, and day/time availability. — [Toast: Offers Dashboard](https://support.toasttab.com/en/article/Using-the-Offers-Dashboard)

**Stamp Me**
- A single "loyalty portal" handles stamp-card rewards, birthday club, welcome rewards, random rewards and lapsed/win-back rewards. — [Stamp Me: How it works](https://www.stampme.com/how-it-works)
- "You can set rewards upon a qualifying purchase, a birthday, signing up, lapsed interaction, and even at random", issued "in-app as vouchers for face-to-face redemption, or digitally via email (e.g. a discount code)." — [Stamp Me support](https://support.stampme.com/punch-card-app/) (from search snippet)

**Loyverse**
- There is no reward catalog. Loyalty is a points-as-currency model (default 1 point per 100 spent, 1 point = 1 currency unit). The cashier redeems points as a discount amount on the ticket. — [Loyverse: Set up loyalty](https://help.loyverse.com/help/how-customer-loyalty-program); [Loyverse: Redeem points](https://help.loyverse.com/help/points-discounts)

### Inferences
- In the more mature platforms, one reward definition (template/redeemable) plus many issuers (points program, campaigns, manual gift, support) is the common design. Punchh is the clearest case: "offers" is only the umbrella over distribution mechanisms.
- Square and Toast split loyalty rewards from marketing coupons, which looks like a product-history artifact: two separately sold add-ons. Customer-facing symptoms follow from it: stacking behavior, and two places to configure discounts. Toast's rule that codes only work in one-time emails suggests the marketing side is weakly modeled.
- The only inline case found is Punchh POS coupons ($ off/% off typed in the campaign). Even Punchh sends anything richer (free item, BOGO) through a redeemable.
- For a small bar/café SaaS this supports a shared "reward catalog" entity that both the points/stamp program and campaigns reference, with issued rewards as separate per-customer instances. This is an inference, not a vendor claim.

### Gaps
- I could not confirm from Square help whether a Square Marketing automated campaign (birthday/win-back) creates its coupon inline in the campaign wizard or selects a saved coupon. The fetched help pages did not say.
- The Thanx merchant dashboard UI (as opposed to the API) was not verified: can a merchant reuse a reward template in loyalty tiers and in campaigns at the same time? The API only shows campaigns referencing templates.
- The Paytronix admin UI for defining rewards and offers was not found in public docs. Only the POS integration API was.
- Belly (historical) and Lightspeed were not researched. Clover was only seen through aggregator snippets ("free item at 100 points or a 10% discount at 200 points"), and the official page [Clover: Create a rewards program](https://www.clover.com/en-US/help/create-rewards-program) was not fetched.

## Q2. Which reward types are supported, and is a free item tied to a POS catalog item?

### Takeaway
All platforms support $ off and % off. Most support free item. The POS-native ones (Square, Paytronix, and Punchh via POS mapping) tie a free item to catalog items or categories. Standalone apps (Stamp Me, Thanx manual in-store) rely on text/fine print plus staff judgement.

### Cited Findings
- Square loyalty tiers can be a discount on the entire sale, on specific categories or on specific items (fixed or %), or a free item from the catalog. Free items "don't automatically populate orders". — [Square Developer: Loyalty overview](https://developer.squareup.com/docs/loyalty/overview)
- A Square marketing coupon can be % off with a max $ cap, restricted to an item or category, with an expiration. A free item is done as 100% off. — search snippets from Square Community ([free item promo](https://community.squareup.com/t5/Customer-Engagement/setting-a-free-item-promo/td-p/807411)); not verified on the official help page.
- Toast loyalty offers cash rewards and free-item rewards. — [Toast Loyalty FAQ](https://support.toasttab.com/en/article/Toast-Loyalty-FAQ-1492794694913). Toast offers support fixed $/%, BOGO on specific items, "$X off when you spend $Y" and free item with minimum. — [Toast Offers Dashboard](https://support.toasttab.com/en/article/Using-the-Offers-Dashboard)
- Punchh redeemables support free item, discount/promotional price, BOGO and Buy X Get Y. — [PAR](https://developers.partech.com/docs/dev-portal-developer-resources/punchh-offers-and-program-types). A POS coupon message is shown when the coupon is scanned. — [PAR Coupon Campaign](https://product-docs.partech.com/docs/punchh/files/product-features/Coupon-Campaign)
- Paytronix discount types include `PERCENT_DISCOUNT`, `DOLLAR_DISCOUNT`, `POS_DISCOUNT` and `REDUCE_PRICE_TO`. Rewards are `FIXED_AMOUNT` or `OPEN_AMOUNT`, and eligibility is tied to item identifiers in the Paytronix DB. — [Paytronix Check Service](https://developers.paytronix.com/pxs_api_reference/check.html)
- Thanx reward redemption types: manual (in-store, with an optional encoded coupon code), manual digital (online ordering), points (bonus points), experience (access pass: image + URL) and automatic (card-linked statement credit). — [Thanx: Reward overview](https://docs.thanx.com/consumer/rewards/overview.md)
- Loyverse only redeems points as a monetary discount. — [Loyverse](https://help.loyverse.com/help/points-discounts)

### Inferences
- The Thanx "experience" type and the Punchh "Merchandise" property show that non-discount or custom-text rewards are first-class in the enterprise tools. Offering a free-text "custom" reward type is standard.
- Without a POS catalog (our case in Ecuador), a free item is best modeled as a name/description plus an optional reference value, with staff validating it. That is what Stamp Me and Thanx manual in-store rewards effectively do. (Inference.)

### Gaps
- No public doc found on how Punchh maps a free-item redeemable to POS menu item IDs (the process "POS mapping" was not documented in the fetched pages).

## Q3. Cost/margin, expiration, per-customer limits, redemption caps, snapshot at issuance

### Takeaway
Expiration is universal and usually set in two ways: an absolute date and N days after issuance. Per-guest use limits and campaign-level caps exist in Punchh. Square snapshots the discount definition by referencing a versioned catalog object. Explicit cost/margin fields were not found in public docs; Punchh only claims "margin protection" at a marketing level.

### Cited Findings
- Punchh redeemable: `expiry_date` (absolute), `expiry_days` (relative to receipt) and `redemption_expiry`. — [PAR webhook Redeemables](https://developers.partech.com/docs/dev-portal-webhooks-manager/events/redeemables)
- Punchh coupon campaign: "Use(s) per guest", "Campaign Based Throttling sets a limit on how many coupons from this specific campaign may be redeemed", "Expiry Days field to set the number of days a coupon remains valid after it has been generated". — [PAR Coupon Campaign](https://product-docs.partech.com/docs/punchh/files/product-features/Coupon-Campaign)
- Thanx campaign: `retire_after_days` (1–999 days from issuance) or a fixed `redeemable_to`, plus `redeemable_from`. Expiration is set on the campaign, not the template. — [Thanx Create Campaign](https://docs.thanx.com/partner/campaigns/create-campaign.md). Thanx also "automatically optimizes... redemption windows for rewards" — [CSP Daily News](https://www.cspdailynews.com/technologyservices/thanx-campaigns-offers-revenue-based-loyalty-insights) (press, via search snippet)
- Square: "By default, a coupon expires two months after the campaign is sent, unless you've set it to expire on a different date." — [Square: Create marketing campaigns](https://squareup.com/help/us/en/article/8412-create-marketing-campaigns)
- Square: one online coupon code per checkout. — [Square vanity coupons](https://squareup.com/help/us/en/article/8485-create-vanity-code-coupons)
- Square snapshot/versioning: a reward tier's `pricing_rule_reference` has "object_id and catalog_version fields ... used to retrieve the discount details". When a reward is issued, "points required to redeem the reward are removed from the loyalty account and held in reserve" until it is redeemed or deleted. States are `ISSUED`, `REDEEMED` and `DELETED`. — [Square Developer: Loyalty rewards](https://developer.squareup.com/docs/loyalty-api/loyalty-rewards); [Loyalty overview](https://developer.squareup.com/docs/loyalty/overview)
- Toast offers: single-use toggle; "either be set to expire after 30 days or never expire". — [Toast Offers Dashboard](https://support.toasttab.com/en/article/Using-the-Offers-Dashboard). Toast birthday reward window: birthday only, birthday month, or a custom ± N days window. — [Toast birthday rewards](https://support.toasttab.com/en/article/Adding-a-Birthday-Rewards-Program) (search snippet)
- Punchh markets "built-in margin protection" and 200+ templates. — [Punchh blog](https://punchh.com/blog/2025/09/29/loyalty-that-guests-actually-want-to-play/) (marketing page, via search snippet)

### Inferences
- Common pattern: the reward definition carries what the benefit is. The issuer (campaign or program) carries when it is valid and how many times (expiry relative to issuance, per-guest uses, total cap). Thanx puts expiry on the campaign; Punchh allows it on both.
- Square's versioned reference is the one documented snapshot mechanism. Editing a reward definition should not silently change rewards already issued. Copying the key fields onto the issued-reward row, or versioning the catalog entry, would achieve the same. (Inference.)

### Gaps
- No platform publicly documents a per-reward cost/COGS field for margin reporting. Paytronix and Punchh may have one in admin UIs that are not public.

## Q4. How redemption works with and without POS integration

### Takeaway
With a POS, rewards are applied inside the check (Square, Toast, Paytronix, Punchh POS API). Without one, platforms fall back to a staff-scanned member code or QR, a displayed coupon code, or manual marking in a merchant portal (Stamp Me, Thanx manual in-store). All keep an issued-reward state machine (available/issued → active → used/redeemed, or voided/deleted).

### Cited Findings
- Square POS: staff enter coupon codes at checkout, coupons show in the customer profile, and "Reward Available" is prompted when points suffice. — [Square: Apply coupons and rewards](https://square.site/help/us/en/article/5522-apply-rewards-to-purchases). The API applies the discount automatically when an order ID is supplied; otherwise the merchant applies it manually. — [Square Developer: Loyalty rewards](https://developer.squareup.com/docs/loyalty-api/loyalty-rewards)
- Toast: the birthday reward is auto-added to the order if no loyalty reward is available, and guests choose between the birthday and loyalty rewards when both exist. — [Toast birthday rewards](https://support.toasttab.com/en/article/How-Birthday-Rewards-Work)
- Paytronix: the POS sends check data plus `DiscountItem` entries with `walletCode`/`walletQuantity`, and Paytronix computes eligibility. — [Paytronix Check Service](https://developers.paytronix.com/pxs_api_reference/check.html)
- Punchh: coupons are single-use alphanumeric codes, often unique per guest, redeemed via POS or app, with a "POS Coupon Message" shown on scan. — [PAR Offers](https://developers.partech.com/docs/dev-portal-developer-resources/punchh-offers-and-program-types); [PAR Coupon Campaign](https://product-docs.partech.com/docs/punchh/files/product-features/Coupon-Campaign)
- Thanx: the states are available → active (the customer activates) → used. Manual in-store rewards may show an encoded coupon code for staff, and online-ordering rewards are marked used automatically. — [Thanx: Reward overview](https://docs.thanx.com/consumer/rewards/overview.md); [Activate Reward](https://docs.thanx.com/consumer/rewards/activate-reward.md); [Finalize Reward](https://docs.thanx.com/consumer/rewards/finalize-reward.md)
- Stamp Me (no POS): the customer shows a Member Code (app or Apple/Google Wallet) and staff scan it with the Merchant App. Unique QR or alphanumeric codes can be printed. There is also manual entry in the Loyalty Portal. "There is no software, hardware or point-of-sale integration required." — [Stamp Me: How it works](https://www.stampme.com/how-it-works); [Stamp Me support](https://support.stampme.com/punch-card-app/)
- Loyverse: the cashier picks the customer on the ticket, taps "Redeem points" and enters an amount up to the maximum. — [Loyverse: Redeem points](https://help.loyverse.com/help/points-discounts)

### Inferences
- For a no-POS bar/café product, the Stamp Me and Thanx manual pattern (customer shows a QR or code, staff scan it or mark the reward used) is the proven baseline. The issued-reward instance needs its own state and expiry whatever catalog entity it came from.

### Gaps
- Reddit, G2 and Capterra user sentiment on "separate places to configure loyalty rewards vs marketing coupons" (Square/Toast) was not collected because of the tool budget.
