# 🎬 AnimeDrama

A minimalist, high-performance static web application built to be hosted on **GitHub Pages**.

---

## 🌟 Key Highlights

1. **Clean Homepage (Search Bar + Logo Only)**:
   - Centered YouTube/Google-style homepage with only the brand logo and the search bar.
   - Zero clutter and zero pre-loaded cards on startup.
   - Instant clear button (`✕`), search submit button, and `/` keyboard focus shortcut.
   - Quick search hints (`Entes`, `Revenge`, `CEO`, `System`, `Dubbed`, `Romance`).

2. **100% Dynamic Real-Time Search**:
   - Searches send live requests to:
     `https://narto-drama.com/search?lang=en-US&q={searchRequest}`
   - Automatically routes through CORS proxies (`AllOrigins`, `CodeTabs`, Direct) so requests succeed smoothly on GitHub Pages.
   - Fetches and parses the returned HTML document on the fly using `parser.js`.

3. **Custom Anime Cards**:
   - 3:4 portrait ratio posters with glowing borders and 3D hover elevation.
   - Dynamic badges for episode count and provider.
   - Hover anime play button overlay and "Watch Online ↗" direct link.
   - Initial gradient avatar fallback if posters fail to load.

4. **Dynamic Episode Fetching**:
   - Clicking any drama card opens the Quick View modal.
   - Dynamically fetches the drama's detail HTML page to extract the **real episode list** (`EP 1`, `EP 2`, ..., `EP 61`).
   - Every episode button links directly to that specific episode on Narto Drama!

5. **Built-in "Paste HTML" Tool**:
   - Inspect any raw HTML document directly (from search or drama watch pages).

---

## 🚀 How to Deploy to GitHub Pages (2 Minutes)

1. **Initialize Git & Commit**:
   ```bash
   git init
   git add .
   git commit -m "AnimeDrama with dynamic search and anime cards"
   ```

2. **Push to your GitHub repository**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Open your repository on GitHub.
   - Go to **Settings** &rarr; **Pages** (in the left sidebar).
   - Under **Build and deployment** &gt; **Branch**, select `main` and `/ (root)`, then click **Save**.
   - Your site will be live at `https://<your-username>.github.io/<your-repo-name>/` in ~60 seconds!

---

## 💻 Running Locally

- **Option 1**: Simply double-click `index.html` to open it in any web browser.
- **Option 2** (Local web server):
  ```bash
  python -m http.server 8000
  ```
  Then navigate to `http://localhost:8000`.
