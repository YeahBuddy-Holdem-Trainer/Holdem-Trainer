# Hold'em Trainer

A Texas Hold'em training app that runs on GitHub Pages, with Firebase sign-in so each player's training is saved to their own account.

## What's in each file

| File | What it holds |
|---|---|
| `index.html` | The page itself: the layout and the markup for every screen. It loads everything below. |
| `css/app.css` | All colors, fonts and layout. The league colors and the blue Tournament / red Cash backdrops are at the top. |
| `js/engine.js` | Cards, hand ranking and equity math used by everything else. |
| `js/core.js` | Shared helpers, the answer log, and saving answers to the account. |
| `js/preflop.js` | Preflop chart trainer and the chart data. |
| `js/drills.js` | Matchups, pot odds, call or fold and street equity drills. |
| `js/ranges.js` | Range builder. |
| `js/sizing.js` | Bet sizing trainer. |
| `js/calculator.js` | Equity calculator. |
| `js/texture.js` | Board texture: range advantage, nut advantage and c-bet plan. |
| `js/equity-drills.js` | Hand vs range and range vs range drills (cash or tournament ranges). |
| `js/board.js` | Range vs board. |
| `js/full-hand.js` | Play a full hand against an opponent type (cash, and the shared engine). |
| `js/full-hand-tour.js` | Tournament full hands: antes, 10-40 BB stacks, push or fold. |
| `js/replay.js` | Hand replayer. |
| `js/icm.js` | ICM calculator. |
| `js/assessment.js` | Assessment quiz. |
| `js/combos.js` | Combinatorics trainer: combos, card removal, range counting, bluff share. |
| `js/hand-log.js` | Hand log and player notes. |
| `js/daily.js` | Daily challenge and the Home screen. |
| `js/feedback.js` | Answer explanations in a pop-up. |
| `js/app.js` | Progress page, sections (Home, Odds, Equity, EV, Ranges, Play) and start-up. |
| `js/cloud.js` | Sign-in and saving to Firebase. |
| `js/firebase-config.js` | Your Firebase project's settings (step 2 below). |
| `firestore.rules` | Security rules: each person can read and write only their own data. |
| `assets/` | Logo and app icons. |

To change one trainer, edit only its file and upload that file to GitHub. The site updates in a minute or two.

## 1. Put it on GitHub Pages
1. In the **yeahbuddy-poker** organization on GitHub, choose **New repository**. Name it `trainer`, make it **Public**, and create it.
2. Choose **uploading an existing file**, drag in everything from this folder (keep the `css`, `js` and `assets` folders), and choose **Commit changes**.
3. Go to **Settings > Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main** and folder **/ (root)**, then **Save**.
4. After a minute the app is live at `https://yeahbuddy-poker.github.io/trainer/`.

The app works at this point, saving on each device. The next step turns on accounts.

## 2. Turn on sign-in with Firebase (free plan, no card)
1. Go to <https://console.firebase.google.com>, choose **Create a project**, and name it (for example `holdem-trainer`). You can turn Google Analytics off.
2. The project starts on the free **Spark** plan. **Never choose Upgrade / Blaze and never add a billing account.** Without one, Firebase cannot charge you; if usage ever passed the free limits, saving would pause until the next day.
3. **Build > Authentication > Get started > Sign-in method**:
   - Enable **Google** (pick your email as the support email) and save.
   - Enable **Email/Password** (the first switch only) and save.
4. **Authentication > Settings > Authorized domains > Add domain**: `yeahbuddy-poker.github.io`
5. **Build > Firestore Database > Create database**. Pick a location near you (for example `us-central1`), start in **production mode**.
6. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, and choose **Publish**.
7. Click the gear icon > **Project settings**. Under *Your apps*, click the **</>** (Web) button, name it `trainer`, leave Hosting unchecked, and register. Copy the values from the `firebaseConfig` it shows into `js/firebase-config.js`, then upload that file to GitHub.

Reload the app: the account button in the top right now opens sign-in.

## How saving works
- Signed in: answers, saved ranges, played hands, logged hands, player notes, daily progress and your name save to your account and appear on any device you sign in on. You stay signed in until you choose **Sign out**.
- Not signed in: everything stays on that device. The first time you sign in there, it moves into your account.
- Signing out removes the training from that device (it stays in the account), so a shared device doesn't show your data to the next person.
- To keep within the free limits, answers are saved in one document per day, and each visit only downloads what changed since the last visit (usually 2 reads).
