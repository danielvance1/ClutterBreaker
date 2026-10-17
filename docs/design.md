# ClutterBreaker: MVP Design Doc

*Draft v1, October 16, 2026. App name: ClutterBreaker. Project folder: ChoresGameServer (\~/myapi).*

**For a new chat:** I'm pasting this so you have the full context. Treat the decisions here as settled unless I say otherwise. The next step is Phase 1 of the roadmap in section 12.

## 1. Overview

I'm building ClutterBreaker, a chores app that plays like a game. Parents post chores as 'quests' with a coin reward. Kids in the family see the quests, mark them done, and the parent verifies and approves or rejects. On approval the kid gets the promised coins plus a chest with a random bonus. Kids spend coins in a reward shop that the parent controls (for example, 30 minutes of extra screen time). Long term this grows into a full game layer (pet, mini-games, crafting), but the MVP is only the core loop plus two hooks: the chest opening and the reward shop.

**MVP goal:** put it in front of real families, watch real kids use it, and find out what is boring.

## 2. Users

- **Parents:** create the family, add kids, post and edit quests, approve or reject submissions, manage the reward shop, and fulfill redemptions.
- **Kids (target ages 8-12):** see quests, submit them as done, open chests, and spend coins. Kid profiles use a nickname and PIN only, with no email and minimal data. This is designed to be COPPA-friendly, but I need to check the legal requirements properly before any public launch.
- **First testers:** my family and friends. Everyone uses iPhones.

## 3. Tech stack and environment

- **Dev machine:** Linux laptop (repurposed Windows laptop), VS Code.
- **Backend:** Node 22 (via nvm), TypeScript run with `tsx`, Express, and `pg` with hand-written parameterized SQL. No ORM.
- **Database:** PostgreSQL 16 in Docker (`docker-compose.yml`), schema in `db/schema.sql`. Add a migration tool (`dbmate` or `node-pg-migrate`) once the schema starts changing. Connection string comes from `DATABASE_URL` in an uncommitted `.env`.
- **Frontend:** React + TypeScript + Tailwind via Vite, in `~/myapi/client`. The dev server runs on 5173 and proxies API calls to Express on 3000. In production, Express serves `client/dist`.
- **Delivery:** mobile-first PWA (`vite-plugin-pwa`), installed on iPhones through Safari's Add to Home Screen. No App Store for the MVP.
- **Later:** Capacitor to wrap the same code as a native app, and Phaser for real-time sprite mini-games.
- **CI/CD:** deferred. The plan is GitHub Actions deploying the `release` branch to a cheap VPS with Docker Compose, behind HTTPS (Caddy).

## 4. MVP scope

**In:**

- Parent and kid accounts inside a family
- Quests with coin rewards: create, submit, approve, reject (with a note), resubmit
- Coin wallet backed by an append-only ledger
- Chest opening on approval with a random bonus
- Parent-defined reward shop: parent creates rewards, kid requests, parent fulfills or declines
- Mobile-first web app, installable as a PWA
- Recurring quests (daily or weekly), since real chores repeat

* Open quests: first come, first served, with a claim that expires after about 6 hours
* Family board: kids can see each other's balances and completed quests (sibling rivalry)

**Out (see section 13):** pet, mini-games, crafting, bosses, boosts, learning games, photo proof, native app.

## 5. Core loop

1. Parent creates a quest ('Wash the dishes', 10 coins).
2. Kid sees it on the quest board and taps 'I did it'.
3. Parent sees it in the approvals queue and checks the real-world chore.
4. Parent approves, or rejects with a note.
5. On approval, the quest card breaks in half, the kid receives the quest's coins, and an unopened chest drops out.
6. Kid opens the chest (animation) and gets a random bonus.
7. Kid spends coins in the shop on parent-defined rewards.
8. Parent marks the reward fulfilled.

## 6. Rules

**Quests**

- Belong to a family, and are assigned to one kid or open to any kid. An open quest is first come, first served: the first kid to claim it holds it, and the claim expires after about 6 hours if it isn't submitted, which reopens the quest for everyone.
- The reward is a fixed number of coins set by the parent.
- Recurrence is none, daily, or weekly. A recurring quest becomes available again after its period resets.
- A kid can have only one pending submission per quest at a time.

**Submissions**

- Statuses: pending, approved, rejected. Rejected submissions show the parent's note, and the kid can resubmit.
- Only parents in the same family can approve or reject.

**Chests**

- One chest per approved submission, created in the same transaction as the approval.
- The server rolls the bonus when the chest is created and stores it. The client only plays the animation, so the odds can't be gamed through the API.
- The quest's base coins are credited at approval. The bonus is credited when the kid opens the chest.

**Wallet**

- Balance is the sum of the kid's ledger rows. There is no stored balance column. Kids in the same family can see each other's balances and quests, since sibling rivalry is intentional.
- Every change is a signed ledger row with a reason and a reference. Parents can't manually adjust or revoke coins. Ledger rows come only from system events: quest rewards, chest bonuses, redemptions, and refunds.

**Reward shop**

- The parent defines rewards with a title, description, and coin cost.
- When a kid requests a reward, the coins are deducted immediately (ledger row) and a redemption is created as pending.
- The parent marks it fulfilled, or declines it, which refunds the coins with another ledger row.
- A kid can't request a reward they can't afford.

## 7. Data model

| Table | Key columns |
| --- | --- |
| families | id, name, join\_code, created\_at |
| users | id, family\_id, role (parent or kid), display\_name, email and password\_hash (parents only), pin\_hash (kids only), created\_at |
| quests | id, family\_id, created\_by, title, description, reward\_coins, recurrence (none/daily/weekly), assigned\_to (nullable kid id), claimed\_by (nullable kid id), claim\_expires\_at (nullable), active, created\_at |
| quest\_submissions | id, quest\_id, kid\_id, status (pending/approved/rejected), submitted\_at, reviewed\_by, reviewed\_at, reject\_note, break\_seen\_at (null until the kid has watched the break animation) |
| ledger | id, kid\_id, amount (signed int), reason (quest\_reward, chest\_bonus, redemption, refund), ref\_type, ref\_id, created\_at |
| chests | id, kid\_id, submission\_id (unique), tier, bonus\_coins, created\_at, opened\_at (null until opened) |
| rewards | id, family\_id, title, description, cost\_coins, active, created\_at |
| redemptions | id, reward\_id, kid\_id, cost\_coins (snapshot), status (pending/fulfilled/declined), requested\_at, resolved\_at |

## 8. API sketch

| Endpoint | Who | Purpose |
| --- | --- | --- |
| POST /auth/signup | parent | Create account and family |
| POST /auth/login | parent | Email and password login |
| POST /auth/kid-login | kid | Family join code, kid profile, and PIN |
| POST /kids | parent | Add a kid profile |
| GET, POST /quests | both / parent | List quests, create a quest |
| PATCH, DELETE /quests/:id | parent | Edit or retire a quest |
| POST /quests/:id/claim, /submit | kid | Claim an open quest (the claim expires after about 6 hours), or mark it as done |
| GET /submissions?status=pending | parent | Approvals queue |
| POST /submissions/:id/approve | parent | Approve, credit coins, create chest |
| POST /submissions/:id/reject | parent | Reject with a note |
| GET /chests/unopened | kid | Chests waiting to be opened |
| POST /chests/:id/open | kid | Reveal and credit the bonus |
| GET /wallet, /family/board | kid | Own balance and history, plus every kid's balance and recent completions |
| GET, POST /rewards | both / parent | List or create shop items |
| POST /rewards/:id/redeem | kid | Request a reward |
| GET /redemptions?status=pending | parent | Rewards waiting to be fulfilled |
| POST /redemptions/:id/fulfill, /decline | parent | Resolve a request (decline refunds) |

## 9. Screens (mobile-first)

**Parent:** Home (pending approvals count, front and center), Quests (list, create, edit), Approvals queue, Shop manager (rewards and pending redemptions), Family (kids, PINs, join code).

**Kid:** Quest board, My quests (pending and rejected status), Chests (unopened chests, big and obvious), Family board (every kid's balance and recent completions), Wallet (balance and history), Shop.

**Design notes:** big tap targets, minimal reading, and the chest-opening animation is where the art effort goes (CSS animation plus free assets, for example from Kenney.nl).

**The break (signature moment):** the app's name is the mechanic. Each quest is a slab of clutter, and finishing it breaks it.

- **Pending:** when a kid taps 'I did it', a crack appears across the quest card while it waits for the parent.
- **Approved:** the card splits in half and the halves fall away, and the chest drops out from behind them. The kid taps the chest to open it.
- **Rejected:** the crack seals back up and the parent's note shows on the card, so the kid knows the clutter is still intact.
- The server only stores the status. The client plays the break the first time the kid opens the app after an approval, then sets `break_seen_at` so it doesn't replay. If the kid doesn't open the chest right away, it waits on the Chests screen.
- For the MVP, build it with CSS only: two clip-path halves that slide and rotate apart, then the chest scales in. No sprite engine needed.

## 10. Chest odds and starting economy (all tunable)

The bonus is a percentage of the quest's reward, with a minimum of 1 coin. Every chest gives something, so opening one never feels like a loss.

| Tier | Chance | Bonus |
| --- | --- | --- |
| Common | 60% | +10% |
| Rare | 30% | +25% |
| Epic | 9% | +50% |
| Jackpot | 1% | +100% |

Expected bonus is about 19% on top of the base reward. Starting values: quests worth 5-20 coins, shop items 50-500 coins. Keep the odds and numbers as constants in one config file so they're easy to tune after watching real kids.

## 11. Visibility and notifications

The app only works if people notice it, so this matters.

- **MVP:** in-app badges (pending approval count for parents, unopened chest count for kids) and polling every 30 seconds while the app is open.
- **First addition after the core loop:** Web Push. It works on iPhone (iOS 16.4 or later) once the app is added to the Home Screen and the user grants permission. It needs a service worker, VAPID keys, and the `web-push` library.
- **Cheap alternative for parents:** an email when a kid submits a quest.
- Kids have no email by design.

## 12. Roadmap

1. **Backend foundation:** schema, migrations, auth (parent email and password hashed with argon2 or bcrypt, kid PIN), family creation and join code.
2. **Quest loop API:** quests, submit, approve, reject. Approval runs in a single database transaction.
3. **Chest and wallet:** ledger, chest creation, open endpoint, odds config.
4. **Shop API:** rewards, redemptions, hold and refund logic.
5. **Frontend:** scaffold the Vite + React + Tailwind client (not yet done), parent screens, kid screens, chest animation.
6. **PWA and deploy:** manifest, icons, HTTPS (Cloudflare Tunnel for quick tests, then a VPS), install on family iPhones.
7. **Family test:** watch real kids, note what's boring, tune the economy.
8. **After the MVP:** Web Push, CI/CD pipeline, then the first pipedream feature.

## 13. Pipedream list

**Rewards and economy**

- Two currencies: common coins from quests, rare gems from streaks and bosses
- Reward boosts (2x for a day)
- Streaks and daily quests with bonus chests
- Chest tiers tied to quest difficulty

**Game layer**

- Pet dragon that hatches, gets fed, and grows through stages
- Prize wheel or pick-a-chest mini-game where you can't lose your stake
- Crafting (combine materials into items)
- Room or castle decoration with cosmetic items
- Avatar customization

**Family features**

- Family boss battle: any approved quest damages a shared boss, so siblings cooperate
- Photo proof on submissions so parents can verify from the couch
- Quest templates ('wash dishes', 'take out trash') with suggested coin values
- Native app wrapper (Capacitor) for App Store distribution

**Learning games**

- Times-table speed rounds and mental math, where faster and more accurate earns coins
- Memory games that earn coins, possibly reusing my image-based number memorization project
- Adaptive difficulty that rises as the kid improves
- Economy caution: cap daily learning-game earnings or pay a lower rate than chores, so chores stay the main income

**S****i****d****e****k****i****c****k**** ****N****P****C**

- Shows the kid how to use the app initially.
- Can be used for questions.
- Delivers a tutorial for new features as they become available.
- Motivates the kid to keep using the app with challenges or light banter (don't want to piss off parents with that one).

**M****i****ni****g****a****m****e**** ****A****r****c****a****d****e**

- Minigame arcade where the kids can spend their coins.
- Artificially limit each arcade game in the arcade so only one person can use it at a time, using a queue: a kid plays one round, then the next kid in line plays right after. Idk, my instinct says it might make the games more fun if they are less accessible. Might be bullshit though. We'll see.
- Maybe there can be some easter eggs here. Maybe some easter eggs change your avatar so siblings can see it and get low-key jealous and want to play the game more.
- Maybe the arcade fills up with machines by buying more arcade games with the money.&#32;
- Maybe you get rewards from the arcade games.

## 14. Integrity and security rules

- Every query is parameterized. No string-built SQL.
- Every endpoint checks the caller's role and family\_id.
- Approvals, chest opens, and redemptions run in transactions and are idempotent, so a double tap can't pay twice.
- Chest odds are rolled server-side only.
- Hash passwords and PINs, and rate-limit PIN attempts (a 4-digit PIN is easy to guess).
- `.env` and secrets are never committed.

## 15. Decisions and open questions

- **Recurring quests:** in the MVP.
- **Kid visibility:** kids can see each other's balances and quests (sibling rivalry).
- **Manual coin changes:** parents can't adjust or revoke coins.
- **Open quests:** first come, first served, with the claim expiring after about 6 hours.
- **Age range:** 8-12 is the focus, but the design leaves room for a wider range of ages.
- **App name:** ClutterBreaker.

## 16. Current status

- **Done:** Linux dev environment, Node/TypeScript/Express backend, Postgres in Docker, and a toy `tasks` table with working GET, POST, and PATCH endpoints plus a plain HTML test page.
- **Not done:** the Vite client isn't scaffolded yet, and there's no auth or real schema.
- The toy `tasks` code gets replaced by the real schema and endpoints in Phase 1.

