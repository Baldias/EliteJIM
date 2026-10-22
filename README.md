<div align="center">

<img src="public/pwa-192x192.png" width="96" alt="EliteJIM logo" />

# EliteJIM

**A science-based workout tracker that turns progressive overload into a game.**

Log your sets, watch your estimated 1RM climb, follow a periodized mesocycle and level up every muscle group.
Everything runs on your phone, with no account and no server.

**[▶ Try it live at elite-jim.vercel.app](https://elite-jim.vercel.app/?demo)** · preloaded with demo data, no sign-up, nothing to install

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Zustand](https://img.shields.io/badge/state-Zustand-443E38)](https://github.com/pmndrs/zustand)
[![Offline first](https://img.shields.io/badge/data-100%25%20on%20device-22c55e)](#-your-data-stays-on-your-phone)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<br />

<img src="docs/screenshots/home.png" width="230" alt="Home" />
&nbsp;
<img src="docs/screenshots/workout.png" width="230" alt="Live workout" />
&nbsp;
<img src="docs/screenshots/recap.png" width="230" alt="Session recap" />

</div>

---

## ✨ Highlights

| | |
| :--- | :--- |
| 🏋️ **Fast logging** | Templates pre-fill each set with what you lifted last time. Tap ± to adjust, tap ✓ to complete. |
| 🏆 **Live PRs** | Beat your best estimated 1RM mid-session and the set lights up as a new PR, right away. |
| 📈 **Progressive overload** | Every session is graded **S → D** based on how many exercises you out-performed vs. last time (1RM and top set). |
| 🧬 **Science mode** | A 12-week mesocycle built on Dr. Mike Israetel's volume landmarks (MEV / MAV / MRV), with weekly set targets and *Boss Fight* MRV weeks. |
| 🎮 **RPG progression** | Earn XP, climb from *Rame III* to *Champion* and level up each muscle group separately. |
| 🔥 **Weekly streaks** | A streak counts weeks, not days, so rest days never break it. |
| 🧍 **Muscle map** | A front and back body map shows which muscles you hit in the last 7 days and how hard. |
| 📤 **Share & AI templates** | Send routines to friends, import theirs, or generate one with your favourite AI from a ready-made prompt. |
| 📱 **Installable PWA** | Add it to your home screen and it works like a native app, offline included. |

---

## 📸 Tour

<table>
  <tr>
    <td align="center" width="33%">
      <img src="docs/screenshots/workout.png" width="240" alt="Live workout" /><br />
      <b>Live workout</b><br />
      <sub>Last session and all-time PR for every exercise, steppers for kg and reps, and a PR set highlighted in real time.</sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/screenshots/recap.png" width="240" alt="Session recap" /><br />
      <b>Session recap</b><br />
      <sub>Grade, overload breakdown per exercise, weekly volume against your targets and the XP gained per muscle.</sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/screenshots/progress.png" width="240" alt="Progress" /><br />
      <b>Progress</b><br />
      <sub>Estimated 1RM over time for every exercise, PRs marked on the chart, and the next target to aim for.</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/science.png" width="240" alt="Science" /><br />
      <b>Science</b><br />
      <sub>Your personalised mesocycle: active week, focus muscles and sets done vs. target for each group.</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/profile.png" width="240" alt="Profile" /><br />
      <b>Profile</b><br />
      <sub>Rank, total XP, PRs beaten, overload rate and the last 7 days of volume against MEV / MAV / MRV.</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/levels.png" width="240" alt="Muscle levels" /><br />
      <b>Muscle levels</b><br />
      <sub>Each muscle group levels up on its own. Progressive overload is worth far more XP than just piling up sets.</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/activity.png" width="240" alt="Activity" /><br />
      <b>Activity</b><br />
      <sub>Weekly streak, yearly heatmap and sessions per week at a glance.</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/bodymap.png" width="240" alt="Muscle map" /><br />
      <b>Muscle map</b><br />
      <sub>Which muscles you trained this week, shaded by number of sets.</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/home.png" width="240" alt="Home" /><br />
      <b>Home</b><br />
      <sub>Your routines, one tap to start, or a free session when you want to improvise.</sub>
    </td>
  </tr>
</table>

> The app interface is in Italian. Screenshots use demo data.

---

## 🧠 How it works

### Session grade

At the end of every workout EliteJIM compares each exercise with the last time you did it, using the **estimated 1RM** and the **top set**. The share of exercises where you progressed sets the grade:

| Grade | Meaning |
| :---: | :--- |
| **S** | Overload on at least 75% of the exercises |
| **A** | Overload on at least half of them |
| **B** | Overload on at least one exercise (or a first, baseline session) |
| **C** | Strength held steady |
| **D** | Estimated 1RM dropped on most exercises |

Deload weeks of the mesocycle are graded differently: there you get rewarded for *controlling* volume, not for pushing it.

### Volume landmarks

| Landmark | Meaning |
| :--- | :--- |
| **MV** | Maintenance Volume |
| **MEV** | Minimum Effective Volume |
| **MAV** | Maximum Adaptive Volume |
| **MRV** | Maximum Recoverable Volume |

A short quiz (sex, whether you train legs, bodyweight and main lifts, focus muscles, days per week) sets your strength level and adapts the landmarks to you. The 12-week mesocycle then ramps your weekly set targets from MEV toward MRV, with *Boss Fight* weeks in W4 and W8.

### Ranks

| Rank | Levels | XP |
| :--- | :---: | :--- |
| 🟤 **Rame** | 0 – 2 | 0 – 2k |
| 🥉 **Bronzo** | 3 – 5 | 3.5k – 7k |
| 🥈 **Argento** | 6 – 8 | 10k – 17k |
| 🥇 **Oro** | 9 – 11 | 22k – 35k |
| 💎 **Platino** | 12 – 14 | 45k – 70k |
| 💠 **Diamante** | 15 – 17 | 90k – 150k |
| 👑 **Champion** | 18 | 250k+ |

---

## 🔒 Your data stays on your phone

EliteJIM has no backend and no account. Workouts, templates and progress are saved in the browser's local storage on your device, and the app asks the browser for persistent storage so it isn't wiped automatically.

To keep your history safe or move it to a new phone, open **Profile → Settings → Sicurezza & Backup Dati** to export a JSON file and import it back later. The app can also remind you to back up after each workout, weekly or monthly.

---

## 🛠️ Tech stack

- **[React 19](https://react.dev/)** + **[Vite](https://vitejs.dev/)** with **[React Router](https://reactrouter.com/)**
- **[Zustand](https://github.com/pmndrs/zustand)** with `persist` for on-device storage
- **[Recharts](https://recharts.org/)** for charts, **[React Body Highlighter](https://github.com/GV79/react-body-highlighter)** for the muscle map
- **[Lucide](https://lucide.dev/)** and **[React Icons](https://react-icons.github.io/react-icons/)**
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** for install and offline support
- **[Vercel Speed Insights](https://vercel.com/docs/speed-insights)**

---

## 🚀 Getting started

**Requirements:** Node.js 18+

```bash
git clone https://github.com/Baldias/EliteJIM.git
cd EliteJIM
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

To try it on your phone, open the dev server from your local network (`npm run dev -- --host`) or deploy the build, then use **Add to Home Screen**.

---

## 📄 License

Released under the [MIT License](LICENSE).

---

<div align="center">
  <sub><i>Work hard. Level up.</i></sub>
</div>
