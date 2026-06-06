# OpenSource / Index 📊

A blazing fast, zero-maintenance dashboard that tracks and showcases your open-source contributions.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build](https://img.shields.io/badge/build-GitHub%20Actions-success.svg)

## 🌟 Features
- **Standout Showcase:** Automatically highlights your merged PRs to top organizations, sorted by repository stars.
- **Intelligent Linking:** Cross-references timeline items to explicitly link Issues with their resolving PRs.
- **Privacy First:** Safely aggregates private contributions into secure summary counts.
- **Zero Maintenance:** Runs daily via GitHub Actions, compiling into a blazing-fast static site.

## 🛠 Architecture
- **Backend (`fetch_data.js`):** Node.js script querying the GitHub GraphQL API to compile `data.json`.
- **Frontend (`app.js`, `style.css`):** Lightweight Vanilla JS/CSS for a responsive, premium UI.
- **CI/CD:** GitHub Actions fetches data daily and deploys directly to GitHub Pages.

## 🚀 Quick Setup
1. **Fork/Clone** this repository.
2. Generate a **Classic PAT** with `repo` scope in GitHub Developer Settings.
3. Add it as a repository secret named `PAT_TOKEN` (`Settings > Secrets and variables > Actions`).
4. Enable **GitHub Pages** with the Source set to **GitHub Actions**.
5. Run the `Fetch Data and Deploy Site` workflow manually to go live immediately!

## 💻 Local Development
To work on the dashboard UI locally without needing to generate or download data:
1. Run `npm install` (if you need to install the primer octicons).
2. Run a local web server, for example: `npx http-server`
3. Open the provided localhost link.

The app detects when it's running locally and automatically fetches your latest live data from GitHub Pages so you can preview UI changes instantly!
