# Promotion/loyalty engines and e-commerce loyalty apps: how they model rewards vs campaigns (Talon.One, Voucherify, Smile.io, Yotpo, LoyaltyLion)

Method note: sources are fetched with a summarizing fetch tool, so the "quotes" below are the tool's excerpts of each page, not verbatim copies I checked character by character. ~20 tool calls in total. Pages I could not reach are listed under Gaps.

## Talon.One: reward entity vs effects in rules; coupons; giveaways; templates

### Takeaway
Talon.One has **two layers**. The incentive logic (discounts, free items, create coupon, award giveaway, add points) lives as **effects inside campaign rules**. Separately, a newer first-class **Reward** object exists: customers unlock it with loyalty points, and it carries its own eligibility rules and reward rules/effects. Coupons are strictly **campaign-scoped**. Giveaway pools are reusable code stores that campaign rules award as an effect.

### Cited Findings
- Effects are "what you want your rules to achieve". A rule can carry several effects, plus "failure effects" that fire when conditions are not met. There are two categories: promotion-rule effects and strikethrough-rule effects — [Talon.One Effects overview](https://docs.talon.one/docs/product/rules/effects/overview)
- The docs define Rewards as "incentives that customers can browse, unlock, and use. Examples of rewards include discounts, free items, and giveaways." Customers usually unlock them by spending loyalty points ("The points are deducted from the specified loyalty program and subledger"). A reward has a status (Active/Inactive) and a customer-specific status (Unlocked/Used). It has **eligibility rules** (who can unlock it) and **reward rules** (the effects applied on use). Each reward belongs to one Application. The page also points to a Catalog API that returns customer-facing reward details — [Talon.One Rewards overview](https://docs.talon.one/docs/product/rewards/overview)
- Creating a reward: you set a name, an API identifier, an optional description and the connected Application ("You can't edit the connected Application after you create the reward"). Eligibility is either "Add Condition" or "Always eligible". Reward rules need "at least one effect", or you can choose "Always allow using this reward". The point cost is set separately: you pick the loyalty program, the subledger and the number of points — [Talon.One Create rewards](https://docs.talon.one/docs/product/rewards/create-rewards)
- Coupons are campaign-scoped. To create codes you open "the campaign where you want to create coupon codes" and click Coupons, after turning on the coupons feature for that campaign. Each coupon or batch gets its own usage limit per customer, validity dates, recipient, attributes and a "Reservation mandatory" flag. Campaign-level budgets also apply ("any campaign-level limit that is reached first applies") — [Talon.One Create coupons](https://docs.talon.one/docs/product/campaigns/coupons/create-coupons)
- The Coupons page of a campaign lists and manages every code generated for that campaign — [Talon.One Coupons page](https://docs.talon.one/docs/product/campaigns/coupons/coupon-page-overview)
- Campaign templates carry default attributes. In a template's Coupons settings you can edit the characteristics of codes that any "Create coupon code" effect generates in campaigns created from that template — [Talon.One Managing templates](https://docs.talon.one/docs/product/campaigns/templates/managing-templates) (seen as a search snippet; I did not fetch the page)
- Giveaway pools "store codes or vouchers generated outside of Talon.One". You activate the giveaway feature in a campaign, import codes into the pool, and campaign rules award codes when conditions are met. Pools connect to Applications, and only within the same environment — [Talon.One Giveaways overview](https://docs.talon.one/docs/product/giveaways/overview)
- Custom coupon attributes (for example "coupon belongs to the current user") are how per-user logic is built on top of coupons — [Talon.One Creating custom coupons](https://docs.talon.one/docs/dev/tutorials/creating-custom-coupons) (search snippet)

### Inferences
- In Talon.One the historically central abstraction is "campaign → rules → effects". A discount is not a reusable object. You rebuild it as an effect in each campaign, and you reuse it through **campaign templates**. The Reward object is an add-on for "spend points to unlock". Even that reward defines its effect *inside itself* through rules, so it is not a pointer to a shared discount definition.
- Coupons are always owned by one campaign. A code's value comes from the campaign's rules evaluated at redemption time, not from a snapshot stored on the coupon. This is an inference from the architecture: I found no doc stating snapshot semantics.

### Gaps
- I did not fetch the "available effects" list page, so the exact list of effect names (setDiscount, addFreeItem, createCoupon, awardGiveaway, addLoyaltyPoints, etc.) is not cited here.
- "Achievements" was not researched: I ran out of call budget.
- I found no doc on what happens to unlocked rewards, or to coupons already issued, when a reward or campaign rule is edited.
- Cost/margin tracking: I found budgets (campaign-level limits) but no per-reward cost-of-goods field.

## Voucherify: Rewards vs Campaigns vs Vouchers

### Takeaway
Voucherify has an explicit, **reusable Reward catalog** that is separate from campaigns. A reward of type CAMPAIGN *points to* a source campaign (a discount-coupon, gift-card or loyalty campaign), and redeeming it publishes a voucher from that campaign. Rewards are attached to loyalty or referral campaigns through a **Reward Assignment**, which holds the per-campaign point cost.

### Cited Findings
- "You can create rewards in the Reward catalog to use them across your campaigns." "You can now assign the created reward to loyalty or referral campaigns." Reward kinds: digital (discount coupons for order, product, free items, shipping or bundles; gift card credits, which auto-publish a card if needed; loyalty points), pay with points, and material (catalog products with manual fulfillment, where redemptions start as PENDING until confirmed). Referral campaigns also use tier-based assignments — [Voucherify Create rewards](https://docs.voucherify.io/optimize/create-rewards)
- Reward object fields: `id`, `name`, `type` (`CAMPAIGN` | `COIN` | `MATERIAL`), `stock` ("Configurable for material rewards"), `redeemed` (count), `attributes` (image_url, description), `metadata`, `parameters` (CAMPAIGN: `campaign.id`, `campaign.balance`, `campaign.type` ∈ DISCOUNT_COUPONS / GIFT_VOUCHERS / LOYALTY_PROGRAM; COIN: `exchange_ratio`, `points_ratio`; MATERIAL: `product.id`, `sku_id`), `created_at`, `updated_at` — [Voucherify Reward object](https://docs.voucherify.io/reference/reward-object)
- Reward Assignment fields: `reward_id`, and `parameters.loyalty.points` ("Number of points that will be subtracted from the loyalty card points balance if the reward is redeemed"), linked by `related_object_type: "campaign"` and `related_object_id`. A 409 is returned "if there's a reward assignment created for the given reward". I read this as one assignment per reward per campaign, but the scope is not stated — [Voucherify Create reward assignment](https://docs.voucherify.io/reference/create-reward-assignment-1)
- Pay with points maps a number of points to a cash amount — [Voucherify Reward object search snippet](https://docs.voucherify.io/docs/rewards)

### Inferences
- The actual discount definition (percent, amount, free item, shipping) is **not on the Reward**. It lives on the source *discount campaign* (its voucher template). The Reward is a thin wrapper, "points → publish a voucher from campaign X", plus a catalog entry for display. This gives a three-layer model: discount campaign (the definition, which issues vouchers) ← Reward (a catalog item) ← Reward Assignment (the price in points inside a loyalty or referral campaign).
- Issued vouchers belong to their source campaign. Whether a voucher snapshots the discount or follows later edits to the campaign is not documented in what I read. The Reward object page itself says nothing about snapshots.

### Gaps
- I did not fetch material on "Promotion tiers" (cart-level promotions without codes) or on the Campaign/Voucher objects themselves.
- I did not confirm whether one reward can be assigned to several campaigns with different point costs. The catalog language says "across your campaigns", which suggests yes.
- I found no cost/margin field on rewards (only stock and a redeemed count).

## Smile.io, Yotpo, LoyaltyLion: are rewards defined once and reused across points, referrals, birthday and VIP?

### Takeaway
No. In all three e-commerce apps, rewards are configured **per feature**: points "ways to redeem", referral advocate and friend rewards, VIP or tier entry rewards and tier benefits each get their own setup screen and their own reward instance. None of them has a shared reward catalog that those features point to. The shared layer is the **reward *type* vocabulary** (fixed $ off, % off, free shipping, free product, gift card, custom), and each program feature instantiates its own copy.

### Cited Findings (Smile.io)
- Ways to redeem are created in the points program: "enter the required points and the discount amount". Discounts must be whole numbers. There is an optional discount code prefix and an Active/Disabled switch. Restrictions such as minimum purchase or collections are configured separately. "Disabling a way to redeem won't remove previously issued rewards—customers can still use existing coupons on a purchase." Rewards come in "Fixed amount of points" and "Increments of points" styles — [Smile Configure ways to redeem](https://help.smile.io/en/articles/4036271-configure-ways-to-redeem-points)
- Referral rewards are configured separately under Program > Referrals, with a "Referring customer reward" card and a "Referred friend reward" card, each with "Add reward" — [Smile Configure referral program rewards](https://help.smile.io/en/articles/4036288-configure-referral-program-rewards) (search snippet); [Smile advocate reward](https://help.smile.io/en/articles/4036292-configure-referring-customer-or-advocate-reward)
- VIP tiers have their own tier entry rewards ($ or % discount) and their own per-tier earning rates. There is also a "VIP exclusive ways to redeem" option — [Smile Referrals page/search snippets](https://smile.io/referrals); [Smile ways to redeem](https://help.smile.io/en/articles/4036271-configure-ways-to-redeem-points)
- Guidance: "100 points = $1 discount value" — [Smile Recommendations](https://help.smile.io/en/articles/5941093-recommendations-for-optimized-points-and-rewards) (search snippet)

### Cited Findings (LoyaltyLion)
- Reward types: flat or percentage discount, free shipping, voucher rewards (free product, product discount, collection discount), seamless free product, subscription product rewards, gift cards, custom rewards, cross-store rewards — [LoyaltyLion What are rewards](https://help.loyaltylion.com/en/articles/1965651-what-are-rewards); [Voucher rewards](https://help.loyaltylion.com/en/articles/1965659-voucher-rewards)
- Editing rules: you can change the point cost afterwards, and "Customers who have already claimed the reward keep the cost they claimed it at." You **cannot** modify the discount amount, type or collection once the reward is created; to offer different terms, "create a new one". "Rewards do not expire unless you give them an expiration period" (6 months recommended), and expiry only applies to rewards claimed after it is turned on. LoyaltyLion advises against minimum spend — [LoyaltyLion What are rewards](https://help.loyaltylion.com/en/articles/1965651-what-are-rewards)
- Tier benefits are configured under Program > Tiers > Benefits, with checkboxes for which tiers a benefit applies to. They come in three kinds: automatic benefits, entry rewards and text-only benefits. Entry rewards can be vouchers, gift cards or custom rewards, but not Recharge or seamless free products. In practice this is a separate configuration that reuses the reward *types*, not the reward records — [LoyaltyLion Tier Benefits](https://help.loyaltylion.com/en/articles/5464060-tier-benefits)
- A custom voucher reward type exists — [LoyaltyLion Custom voucher](https://help.loyaltylion.com/en/articles/16801739-reward-custom-voucher) (search snippet)

### Cited Findings (Yotpo)
- The API separates the **reward/redemption option** (`reward_option_id`) from the **reward instance** (one issuance to one customer, with its own coupon code in `reward_text`, usage status, created and expiry dates, customer link and discount config). Discount types: `fixed_amount`, `percentage`, `generic_fixed_amount`. "If a merchant updates a coupon's expiration date after its creation, the API will not reflect the updated date." — [Yotpo Reward Instances API](https://loyaltyapi.yotpo.com/v3.0/reference/reward-instances-api)
- `GET /api/v2/redemption_options` lists redemption options. Create Redemption checks eligibility and balance, deducts points, generates a coupon code and returns it. `discount_type` can be "custom" — [Yotpo Get Active Redemption Options](https://loyaltyapi.yotpo.com/reference/fetch-active-redemption-options); [Create Redemption](https://loyaltyapi.yotpo.com/reference/create-redemption) (search snippets)
- Marketing pages list redemption options (free shipping, fixed discounts, free products) and VIP perks (free shipping, early access) — [Yotpo Loyalty rewards](https://www.yotpo.com/platform/loyalty/rewards/) (marketing page, low evidentiary weight)

### Inferences
- In all three apps, an issued coupon is effectively a **snapshot**: a real discount code created in Shopify at claim time. The evidence is Smile's "disabling won't remove previously issued rewards", LoyaltyLion's "keep the cost they claimed it at" and its ban on editing the discount terms (a new reward instead), and Yotpo's instance, which does not reflect later expiry edits.
- LoyaltyLion makes discount terms **immutable** after creation. That is a simple way to avoid the "edit a reward that is already issued" problem.

### Gaps
- I did not fetch Yotpo help-center pages on how VIP tier rewards and referral rewards are configured, so the per-feature claim for Yotpo is inferred from the API (redemption options are a points concept) and marketing pages.
- I did not find birthday reward configuration pages for any of the three. I believe they are configured as a "way to earn" (points) or a separate reward, but that is unverified.
- None of the three appears to track cost or margin per reward (no field seen). This is not confirmed.

## Reward types, limits, expiry, and edit/archive behavior (cross-product)

### Takeaway
The common type vocabulary is fixed amount off, % off, free shipping, free product, gift card or store credit, and custom or manual. The engines add BOGO and bundles through rules. Validity and per-customer limits live on the coupon or voucher (Talon.One) or on the reward (Smile, LoyaltyLion). Issued codes survive when a reward is disabled or edited.

### Cited Findings
- Talon.One coupon-level limits: per-customer usage limit, validity dates, recipient, reservation required — [Talon.One Create coupons](https://docs.talon.one/docs/product/campaigns/coupons/create-coupons)
- Voucherify: discount coupons for order, product, free items, shipping and bundles; material stock; manual fulfillment for material rewards — [Voucherify Create rewards](https://docs.voucherify.io/optimize/create-rewards)
- Smile: disabled rewards leave issued coupons usable — [Smile](https://help.smile.io/en/articles/4036271-configure-ways-to-redeem-points)
- LoyaltyLion: expiry is optional, only for future claims, and the terms are immutable — [LoyaltyLion](https://help.loyaltylion.com/en/articles/1965651-what-are-rewards)

### Inferences
- Only Voucherify models physical "material" rewards with stock and a fulfillment status (PENDING → confirmed). This is the closest match to a brick-and-mortar "free coffee" reward that staff hand over.

### Gaps
- None of the docs I read shows an explicit cost-of-goods or margin field on a reward.

## Complaints about complexity

### Takeaway
The engine-style model (Talon.One) is repeatedly described as powerful but hard for non-technical users. I found no complexity complaints specifically about reward-catalog modeling.

### Cited Findings
- G2 summaries: "Users find the learning curve steep"; "For new users, it's a bit difficult to understand what's happening in the rule builder/campaign builder"; offset by praise for rule-builder flexibility — [G2 Talon.One pros and cons](https://www.g2.com/products/talon-one/reviews?qs=pros-and-cons); [G2 Talon.One reviews](https://www.g2.com/products/talon-one/reviews) (these came from an aggregated search summary; I did not fetch individual reviews)

### Gaps
- I did not research G2, Reddit or Shopify App Store complaints about Voucherify, Smile, Yotpo or LoyaltyLion (budget).

## Synthesis for the "reusable reward catalog?" question (all inference)
- Two patterns exist. (a) **Engine/API products** (Voucherify explicitly, Talon.One more recently) have a first-class Reward catalog entity that is separate from campaigns and priced per campaign through an assignment (Voucherify) or a point cost (Talon.One). (b) **SMB e-commerce apps** (Smile, LoyaltyLion, Yotpo) configure rewards per program feature and share only the type vocabulary. The SMB tools optimize for a simple setup screen per feature.
- Every product separates the **definition** (reward or redemption option) from the **issued instance** (coupon or voucher or reward instance), and issued instances keep their terms: they are snapshotted or the terms are immutable.
- Voucherify's split between the reward (what) and the reward assignment (price in points, per campaign) is the cleanest pattern if one reward must appear in the points catalog, in referrals and in tier entry.
