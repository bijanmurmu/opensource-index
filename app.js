document.addEventListener('DOMContentLoaded', () => {
  const contentDiv = document.getElementById('content');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const sortRepos = document.getElementById('sortRepos');
  const toggleExpandBtn = document.getElementById('toggleExpandBtn');
  
  let globalData = null;
  let sortState = { repo: null, type: null, column: null, desc: true };
  let lazyDataCache = {};

  async function loadData(retries = 3) {
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
      const baseUrl = isLocal ? 'https://bijanmurmu.github.io/opensource-index/' : '';
      
      const res = await fetch(baseUrl + 'data-meta.json?v=' + new Date().getTime());
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const meta = await res.json();
      
      globalData = {
        profile: meta.profile,
        repoMeta: meta.repoMeta,
        availableYears: meta.availableYears,
        issues: {},
        prs: {},
        privateCounts: { issues: 0, prs: 0, additions: 0, deletions: 0 }
      };

      const promises = meta.availableYears.map(year => fetch(baseUrl + `data-${year}.json?v=` + new Date().getTime()).then(r => r.json()));
      const yearsData = await Promise.all(promises);
      
      yearsData.forEach(yData => {
        globalData.privateCounts.issues += yData.privateCounts.issues;
        globalData.privateCounts.prs += yData.privateCounts.prs;
        globalData.privateCounts.additions += yData.privateCounts.additions;
        globalData.privateCounts.deletions += yData.privateCounts.deletions;
        
        Object.keys(yData.issues).forEach(repo => {
          if (!globalData.issues[repo]) globalData.issues[repo] = [];
          globalData.issues[repo] = globalData.issues[repo].concat(yData.issues[repo]);
        });
        
        Object.keys(yData.prs).forEach(repo => {
          if (!globalData.prs[repo]) globalData.prs[repo] = [];
          globalData.prs[repo] = globalData.prs[repo].concat(yData.prs[repo]);
        });
      });

      renderProfile(globalData.profile);
      renderAnalytics(globalData);
      renderAll(globalData);
    } catch (err) {
      if (retries > 0) {
        console.warn('Retrying fetch...', retries, 'attempts left');
        setTimeout(() => loadData(retries - 1), 1500);
      } else {
        contentDiv.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6rem 2rem; text-align: center; max-width: 500px; margin: 0 auto; gap: 1.5rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; margin-bottom: 1rem;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h2 style="font-family: var(--font-serif); font-size: 2rem; font-weight: 400; color: var(--text-main); margin: 0;">Data Unavailable</h2>
            <p style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin: 0;">Error loading data-meta.json</p>
            <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-top: 0.5rem;">This usually happens during a live GitHub deployment or when data is syncing.<br><br>Please wait a moment and try refreshing.</p>
            <button onclick="window.location.reload()" class="action-btn" style="margin-top: 1rem; padding: 0.8rem 2rem;">Reload Page</button>
          </div>
        `;
        console.error('Failed to load data:', err);
      }
    }
  }
  loadData();

  function renderAnalytics(data) {
    const langStats = {};
    let totalContributions = 0;

    const processRepo = (repo, count) => {
      const langObj = data.repoMeta[repo]?.language;
      if (langObj && langObj.name) {
        if (!langStats[langObj.name]) {
          langStats[langObj.name] = { count: 0, color: langObj.color || '#8b949e' };
        }
        langStats[langObj.name].count += count;
        totalContributions += count;
      }
    };

    Object.keys(data.prs || {}).forEach(repo => processRepo(repo, data.prs[repo].length));
    Object.keys(data.issues || {}).forEach(repo => processRepo(repo, data.issues[repo].length));

    if (totalContributions === 0) return;

    const sortedLangs = Object.entries(langStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5); // top 5

    let barHtml = '<div class="lang-progress-bar">';
    let legendHtml = '<div class="lang-legend-grid">';
    
    sortedLangs.forEach(([langName, stats]) => {
      const percentage = ((stats.count / totalContributions) * 100).toFixed(1);
      const color = stats.color;
      
      barHtml += `<div class="lang-segment" style="width: ${percentage}%; background-color: ${color};" title="${escapeHtml(langName)}: ${percentage}%"></div>`;
      legendHtml += `
        <div class="lang-legend-item">
          <span class="lang-dot" style="background-color: ${color}"></span>
          <span class="lang-name">${escapeHtml(langName)}</span>
          <span class="lang-pct">${percentage}%</span>
        </div>
      `;
    });
    
    barHtml += '</div>';
    legendHtml += '</div>';
    
    document.getElementById('analytics-container').innerHTML = `
      <div class="analytics-card">
        <h3 class="analytics-title">Top Languages</h3>
        ${barHtml}
        ${legendHtml}
      </div>
    `;
  }

  function renderProfile(profile) {
    if (!profile) return;
    const container = document.getElementById('profile-container');
    const name = escapeHtml(profile.name || profile.login);
    const login = escapeHtml(profile.login);
    const bio = escapeHtml(profile.bio || "Open Source Contributor");
    const followers = profile.followers?.totalCount || 0;
    
    container.innerHTML = `
      <img src="${escapeHtml(profile.avatarUrl)}" alt="Avatar" class="profile-avatar">
      <h1>${name}</h1>
      <p class="profile-bio">${bio}</p>
      <div class="profile-stats">
        <a href="https://github.com/bijanmurmu" target="_blank" class="editorial-profile-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
          <span>@${login}</span>
        </a>   
        <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
          <span class="editorial-profile-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>${followers} followers</span>
          </span>
          <a href="https://bijanmurmu.github.io/link-tree" target="_blank" class="editorial-profile-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon custom-linktree"><path d="M12 22v-9m0 0l-6-6m6 6l6-6m-14 8h16"/></svg>
            <span>Linktree</span>
          </a>
        </div>
      </div>
    `;
    document.title = `${name} | OpenSource Portfolio`;
  }

  function renderAll(data) {
    // Remember previously open folders to persist state across filter/sort
    const previouslyOpen = new Set();
    document.querySelectorAll('.lazy-folder[open]').forEach(f => previouslyOpen.add(f.getAttribute('data-repo-id')));

    lazyDataCache = {};
    let html = '';
    
    // Render Standout Contributions
    renderStandoutContributions(data);

    const allRepos = new Set([
      ...Object.keys(data.issues || {}),
      ...Object.keys(data.prs || {})
    ]);

    const searchQuery = searchInput.value.toLowerCase();
    const filterStatus = statusFilter.value;
    const repoSortMode = sortRepos ? sortRepos.value : 'stars'; // Fallback to stars if missing

    let visibleRepoCount = 0;

    let reposArray = Array.from(allRepos);
    
    // Case-insensitive sort function
    const alphaSort = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

    if (repoSortMode === 'stars') {
      reposArray.sort((a, b) => {
        const starsA = data.repoMeta[a]?.stars || 0;
        const starsB = data.repoMeta[b]?.stars || 0;
        if (starsB !== starsA) return starsB - starsA;
        return alphaSort(a, b);
      });
    } else {
      reposArray.sort(alphaSort);
    }

    reposArray.forEach(repo => {
      let issues = (data.issues[repo] || []).filter(item => matchFilter(item, searchQuery, filterStatus, repo));
      let prs = (data.prs[repo] || []).filter(item => matchFilter(item, searchQuery, filterStatus, repo));

      if (issues.length === 0 && prs.length === 0) return;

      visibleRepoCount++;
      const meta = data.repoMeta[repo] || {};
      const lang = meta.language ? `<span class="lang-badge"><span class="lang-dot" style="background-color: ${escapeHtml(meta.language.color)}"></span>${escapeHtml(meta.language.name)}</span>` : '';
      const starBadge = repoSortMode === 'stars' && meta.stars ? `<span class="lang-badge" style="margin-left:0.25rem;"><i data-lucide="star" style="width:12px;height:12px;margin-right:0.2rem;"></i>${meta.stars}</span>` : '';

      let repoIcon = '<i data-lucide="user" class="lucide-icon"></i>';
      if (meta.ownerType === 'Organization' && meta.avatarUrl) {
        repoIcon = `<img src="${escapeHtml(meta.avatarUrl)}" class="index-org-avatar" alt="Org Logo">`;
      }

      issues = sortItems(issues, repo, 'issues');
      prs = sortItems(prs, repo, 'prs');

      lazyDataCache[repo] = { issues, prs, rendered: false };
      const safeId = escapeHtml(repo).replace(/[^a-zA-Z0-9-]/g, '');
      const isOpen = previouslyOpen.has(repo) ? 'open' : '';

      html += `
      <details class="repo-folder lazy-folder" data-repo-id="${escapeHtml(repo)}" ${isOpen}>
        <summary>
          ${repoIcon}
          <div class="repo-title-wrapper">
            <span class="repo-name">${escapeHtml(repo)}</span>
            <div class="repo-badges">
              ${lang}
              ${starBadge}
            </div>
          </div>
        </summary>
        <div class="repo-content" id="content-${safeId}"></div>
      </details>`;
    });

    if (visibleRepoCount === 0 && (!data.privateCounts || data.privateCounts.issues === 0)) {
      html += '<p class="empty-state-msg">No contributions matched your search.</p>';
    }

    // Append private summary at the bottom as requested
    html += renderPrivateSummary(data.privateCounts);

    contentDiv.innerHTML = html;
    
    // Attach Lazy Load listeners and render already open ones
    document.querySelectorAll('.lazy-folder').forEach(folder => {
      if (folder.open) {
        renderLazyTable(folder.getAttribute('data-repo-id'), folder);
      }
      folder.addEventListener('toggle', (e) => {
        if (folder.open) {
          renderLazyTable(folder.getAttribute('data-repo-id'), folder);
        }
      });
    });

    if (window.lucide) { lucide.createIcons(); }
  }

  function renderStandoutContributions(data) {
    const standoutSection = document.getElementById('standout-section');
    const standoutCards = document.getElementById('standout-cards');
    if (!standoutSection || !standoutCards) return;

    const searchQuery = searchInput.value.toLowerCase();
    
    let orgMap = {};
    Object.keys(data.prs || {}).forEach(repo => {
      const meta = data.repoMeta[repo] || {};
      if (meta.ownerType === 'Organization') {
        const mergedPRs = data.prs[repo].filter(pr => pr.state === 'MERGED');
        // Only include PRs that match the current search filter
        const validPRs = mergedPRs.filter(pr => matchFilter(pr, searchQuery, 'ALL', repo));
        
        if (validPRs.length > 0) {
          const orgName = repo.split('/')[0];
          if (!orgMap[orgName]) {
            orgMap[orgName] = { orgName, prCount: 0, avatarUrl: meta.avatarUrl, stars: 0, prs: [] };
          }
          orgMap[orgName].prCount += validPRs.length;
          orgMap[orgName].stars = Math.max(orgMap[orgName].stars, meta.stars || 0);
          
          validPRs.forEach(pr => {
            orgMap[orgName].prs.push({ ...pr, repoName: repo });
          });
        }
      }
    });

    window.globalOrgMap = orgMap;
    let standouts = Object.values(orgMap);

    if (standouts.length === 0) {
      standoutSection.style.display = 'none';
      return;
    }

    // Sort by repo stars
    standouts.sort((a, b) => b.stars - a.stars);

    let cardsHtml = '';
    standouts.forEach(org => {
      cardsHtml += `
        <a href="#" onclick="window.openOrgModal('${escapeHtml(org.orgName)}'); return false;" class="org-card">
          <img src="${escapeHtml(org.avatarUrl)}" class="org-avatar" alt="Org Logo">
          <div class="org-info">
            <h4 class="org-name">${escapeHtml(org.orgName)}</h4>
            <span class="org-count">${org.prCount} PRs Merged</span>
          </div>
        </a>
      `;
    });

    standoutCards.innerHTML = cardsHtml;
    standoutSection.style.display = 'block';
    
    // Update standout header to "Open Source Organizations"
    const headerTitle = standoutSection.querySelector('.section-title');
    if (headerTitle) {
      headerTitle.innerHTML = '<i data-lucide="award" class="lucide-icon"></i> Open Source Organizations';
    }

    if (window.lucide) { lucide.createIcons({ root: standoutSection }); }
  }

  function renderLazyTable(repoId, folderElement) {
    const cache = lazyDataCache[repoId];
    if (!cache || cache.rendered) return;

    const safeId = escapeHtml(repoId).replace(/[^a-zA-Z0-9-]/g, '');
    const contentBox = document.getElementById(`content-${safeId}`);
    if (!contentBox) return;

    let innerHtml = `
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: flex-end;">
        <a href="https://github.com/${escapeHtml(repoId)}" target="_blank" class="action-btn" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; padding: 0.5rem 1rem;">
          <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Open Repository
        </a>
      </div>
    `;
    if (cache.issues.length > 0) {
      innerHtml += `
      <div class="repo-section">
        <h3>Issues (${cache.issues.length})</h3>
        ${renderTable(cache.issues, true, repoId)}
      </div>`;
    }
    if (cache.prs.length > 0) {
      innerHtml += `
      <div class="repo-section">
        <h3>Pull Requests (${cache.prs.length})</h3>
        ${renderTable(cache.prs, false, repoId)}
      </div>`;
    }
    
    contentBox.innerHTML = innerHtml;
    cache.rendered = true;

    attachSortListeners(contentBox);
    if (window.lucide) { lucide.createIcons({root: contentBox}); }
  }

  function matchFilter(item, query, status, repoId) {
    if (status !== 'ALL' && item.state.toUpperCase() !== status) return false;
    if (query) {
      if (!item.title.toLowerCase().includes(query) && 
          !item.number.toString().includes(query) &&
          !repoId.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  }

  // Modal Logic
  const modal = document.getElementById('org-modal');
  const closeBtn = document.getElementById('modal-close');
  
  if (closeBtn) {
    closeBtn.onclick = function() {
      modal.classList.remove('show');
    }
  }
  
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.classList.remove('show');
    }
  }

  window.openOrgModal = function(orgName) {
    const org = window.globalOrgMap[orgName];
    if (!org) return;

    document.getElementById('modal-title').innerText = orgName + ' Contributions';
    
    // Sort PRs by date (newest first)
    const sortedPRs = org.prs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    let timelineHtml = '<div class="timeline">';
    sortedPRs.forEach(pr => {
      const dateObj = new Date(pr.createdAt);
      const monthYear = dateObj.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      
      let linkedIssuesHtml = '';
      if (pr.linked_issues && pr.linked_issues.length > 0) {
        linkedIssuesHtml = pr.linked_issues.map(i => `
          <div class="timeline-issue-row">
            <span class="timeline-label">Fixes Issue:</span>
            <a href="${escapeHtml(i.url)}" target="_blank" class="timeline-issue-title">
              ${escapeHtml(i.title || 'Issue')} <span class="timeline-issue-num">#${i.number}</span>
            </a>
          </div>
        `).join('');
      }
      
      const adds = pr.additions || 0;
      const dels = pr.deletions || 0;
      
      const repoIconSvg = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right:6px; vertical-align:-3px;"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path></svg>`;

      timelineHtml += `
        <div class="timeline-item">
          <div class="timeline-date">${monthYear}</div>
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-repo">
              <a href="https://github.com/${escapeHtml(pr.repoName)}" target="_blank" class="timeline-repo-link">
                ${repoIconSvg}${escapeHtml(pr.repoName)}
              </a>
            </div>
            <div class="timeline-desc">
              ${linkedIssuesHtml}
              <div class="timeline-pr-row">
                <span class="timeline-label">Fixing PR:</span>
                <a href="${escapeHtml(pr.url)}" target="_blank" class="timeline-pr-title">
                  ${escapeHtml(pr.title)} <span class="timeline-pr-num">#${pr.number}</span>
                </a>
              </div>
            </div>
            <div class="timeline-footer">
              <span class="timeline-badge merged"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"></path></svg> Merged</span>
              <div class="timeline-metrics">
                <span class="impact-add">+${adds}</span>
                <span class="impact-del">-${dels}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    timelineHtml += '</div>';
    
    document.getElementById('modal-body').innerHTML = timelineHtml;
    modal.classList.add('show');
    if (window.lucide) { lucide.createIcons({ root: modal }); }
  };

  function renderPrivateSummary(counts) {
    if (!counts || (counts.issues === 0 && counts.prs === 0)) return '';
    return `
    <div class="private-summary" style="margin-top: 2rem;">
      <div class="private-icon"><i data-lucide="lock" class="lucide-icon-large"></i></div>
      <div class="private-details">
        <h3>Private Contributions</h3>
        <p>Contributions to private repositories are hidden to protect sensitive data.</p>
        <div class="private-stats">
          <div class="private-stats-row">
            <span class="stat-badge">${counts.issues} Issues</span>
            <span class="stat-badge">${counts.prs} Pull Requests</span>
          </div>
          <div class="private-stats-row">
            <span class="stat-badge stat-add">+${counts.additions}</span>
            <span class="stat-badge stat-del">-${counts.deletions}</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderTable(items, isIssue, repoName) {
    const type = isIssue ? 'issues' : 'prs';
    const getSortArrow = (col) => (sortState.repo === repoName && sortState.type === type && sortState.column === col) ? (sortState.desc ? ' ↓' : ' ↑') : '';

    let tableHtml = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th data-repo="${escapeHtml(repoName)}" data-type="${type}" data-col="state">Status${getSortArrow('state')}</th>
            <th data-repo="${escapeHtml(repoName)}" data-type="${type}" data-col="title">Title${getSortArrow('title')}</th>
            ${isIssue ? `<th data-repo="${escapeHtml(repoName)}" data-type="${type}" data-col="fixing">Fixing PR${getSortArrow('fixing')}</th>` 
                      : `<th data-repo="${escapeHtml(repoName)}" data-type="${type}" data-col="fixing">Linked Issue${getSortArrow('fixing')}</th>
                         <th data-repo="${escapeHtml(repoName)}" data-type="${type}" data-col="impact">Impact${getSortArrow('impact')}</th>`}
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach(item => {
      const rawState = escapeHtml(item.state).toLowerCase();
      let stateClass = rawState;
      let displayState = rawState.charAt(0).toUpperCase() + rawState.slice(1);
      
      const githubIcons = {
        'open-issue': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path></svg>',
        'closed-issue': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"></path><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"></path></svg>',
        'open-pr': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path></svg>',
        'closed-pr': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"></path></svg>',
        'merged-pr': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"></path></svg>'
      };

      let iconHtml = '';

      if (isIssue) {
        if (rawState === 'open') {
          iconHtml = githubIcons['open-issue'];
        } else {
          iconHtml = githubIcons['closed-issue'];
          stateClass = 'closed-issue';
          displayState = 'Closed';
        }
      } else {
        if (rawState === 'open') {
          iconHtml = githubIcons['open-pr'];
        } else if (rawState === 'merged') {
          iconHtml = githubIcons['merged-pr'];
        } else {
          iconHtml = githubIcons['closed-pr'];
          stateClass = 'closed-pr';
          displayState = 'Closed';
        }
      }

      const statusHtml = `<span class="status ${stateClass}">${iconHtml} ${displayState}</span>`;
      
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const dateHtml = dateStr ? `<span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem; white-space: nowrap;">${dateStr}</span>` : '';
      
      let thirdColHtml = '';
      if (isIssue) {
        if (item.linked_prs && item.linked_prs.length > 0) {
          const linksHtml = item.linked_prs.map(pr => `<a href="${escapeHtml(pr.url)}" target="_blank">#${escapeHtml(pr.number.toString())}</a>`).join(', ');
          thirdColHtml = `<td data-label="Fixing PR"><span class="linked-pr">↳ ${linksHtml}</span></td>`;
        } else {
          thirdColHtml = '<td data-label="Fixing PR" class="empty-cell"></td>';
        }
      } else {
        let issueHtml = '<td data-label="Linked Issue" class="empty-cell"></td>';
        if (item.linked_issues && item.linked_issues.length > 0) {
          const linksHtml = item.linked_issues.map(issue => `<a href="${escapeHtml(issue.url)}" target="_blank">#${escapeHtml(issue.number.toString())}</a>`).join(', ');
          issueHtml = `<td data-label="Linked Issue"><span class="linked-pr">↳ ${linksHtml}</span></td>`;
        }
        const adds = item.additions || 0;
        const dels = item.deletions || 0;
        const impactHtml = `<td data-label="Impact"><div class="impact-metrics"><span class="impact-add">+${adds}</span> <span class="impact-del">-${dels}</span></div></td>`;
        thirdColHtml = issueHtml + impactHtml;
      }

      tableHtml += `
        <tr>
          <td data-label="Status">${statusHtml}</td>
          <td data-label="Title"><a class="item-link" href="${escapeHtml(item.url)}" target="_blank">#${escapeHtml(item.number.toString())} ${escapeHtml(item.title)}</a>${dateHtml}</td>
          ${thirdColHtml}
        </tr>
      `;
    });

    return tableHtml + `</tbody></table></div>`;
  }

  function attachSortListeners(container = document) {
    container.querySelectorAll('.data-table th').forEach(th => {
      th.addEventListener('click', (e) => {
        const repo = th.getAttribute('data-repo');
        const type = th.getAttribute('data-type');
        const col = th.getAttribute('data-col');
        
        if (sortState.repo === repo && sortState.type === type && sortState.column === col) {
          sortState.desc = !sortState.desc;
        } else {
          sortState = { repo, type, column: col, desc: true };
        }
        renderAll(globalData);
      });
    });
  }

  function sortItems(items, repo, type) {
    if (sortState.repo !== repo || sortState.type !== type || !sortState.column) return items;
    return [...items].sort((a, b) => {
      let valA, valB;
      if (sortState.column === 'state') { valA = a.state; valB = b.state; }
      if (sortState.column === 'title') { valA = a.title; valB = b.title; }
      if (sortState.column === 'impact') { valA = (a.additions || 0) + (a.deletions || 0); valB = (b.additions || 0) + (b.deletions || 0); }
      if (sortState.column === 'fixing') { 
        valA = type === 'issues' ? (a.linked_prs && a.linked_prs.length > 0 ? 1 : 0) : (a.linked_issues && a.linked_issues.length > 0 ? 1 : 0); 
        valB = type === 'issues' ? (b.linked_prs && b.linked_prs.length > 0 ? 1 : 0) : (b.linked_issues && b.linked_issues.length > 0 ? 1 : 0); 
      }
      
      if (valA < valB) return sortState.desc ? 1 : -1;
      if (valA > valB) return sortState.desc ? -1 : 1;
      return 0;
    });
  }

  // Event Listeners for Filters
  searchInput.addEventListener('input', () => { if(globalData) renderAll(globalData); });
  statusFilter.addEventListener('change', () => { if(globalData) renderAll(globalData); });
  if (sortRepos) sortRepos.addEventListener('change', () => { if(globalData) renderAll(globalData); });
  
  let isExpanded = false;
  if (toggleExpandBtn) {
    toggleExpandBtn.addEventListener('click', (e) => {
      e.preventDefault();
      isExpanded = !isExpanded;
      if (isExpanded) {
        toggleExpandBtn.textContent = 'Collapse All';
        document.querySelectorAll('.lazy-folder').forEach(d => {
          if (!d.open) {
            d.open = true;
            renderLazyTable(d.getAttribute('data-repo-id'), d);
          }
        });
      } else {
        toggleExpandBtn.textContent = 'Expand All';
        document.querySelectorAll('.lazy-folder').forEach(d => d.open = false);
      }
    });
  }

  function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return unsafe.toString()
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Scroll Shrink Logic for Mobile
  const controlsContainer = document.getElementById('controlsContainer');
  const controlsToggleBtn = document.getElementById('controlsToggleBtn');
  
  if (controlsContainer && controlsToggleBtn) {
    window.addEventListener('scroll', () => {
      // Only apply scroll logic if we are not in an explicitly expanded state
      if (controlsContainer.classList.contains('is-expanded')) return;
      
      if (window.scrollY > 150) {
        controlsContainer.classList.add('is-shrunk');
      } else {
        controlsContainer.classList.remove('is-shrunk');
      }
    });

    controlsToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      controlsContainer.classList.remove('is-shrunk');
      controlsContainer.classList.add('is-expanded');
    });

    // Close expanded state if user clicks outside of controls container
    document.addEventListener('click', (e) => {
      if (controlsContainer.classList.contains('is-expanded') && !controlsContainer.contains(e.target)) {
        controlsContainer.classList.remove('is-expanded');
        if (window.scrollY > 150) {
          controlsContainer.classList.add('is-shrunk');
        }
      }
    });
  }

  // Keyboard shortcut Ctrl+Alt+K for search
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Custom Dropdowns
  function createCustomDropdowns() {
    const selects = document.querySelectorAll('.dropdown-filter');
    selects.forEach(select => {
      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select';
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      select.style.display = 'none';

      const selected = document.createElement('div');
      selected.className = 'select-selected';
      const textSpan = document.createElement('span');
      const prefix = select.dataset.prefix || '';
      textSpan.textContent = prefix + select.options[select.selectedIndex].textContent;
      selected.appendChild(textSpan);
      
      const arrow = document.createElement('i');
      arrow.setAttribute('data-lucide', 'chevron-down');
      arrow.className = 'select-arrow';
      selected.appendChild(arrow);
      wrapper.appendChild(selected);

      const items = document.createElement('div');
      items.className = 'select-items select-hide';
      
      Array.from(select.options).forEach((opt, index) => {
        const item = document.createElement('div');
        item.textContent = opt.textContent;
        if (index === select.selectedIndex) item.className = 'same-as-selected';
        
        item.addEventListener('click', function(e) {
          select.selectedIndex = index;
          textSpan.textContent = prefix + this.textContent;
          Array.from(items.children).forEach(c => c.classList.remove('same-as-selected'));
          this.classList.add('same-as-selected');
          selected.click();
          select.dispatchEvent(new Event('change'));
        });
        items.appendChild(item);
      });
      wrapper.appendChild(items);

      selected.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllSelect(this);
        items.classList.toggle('select-hide');
        wrapper.classList.toggle('open');
      });
    });

    function closeAllSelect(elmnt) {
      const arrNo = [];
      const items = document.getElementsByClassName('select-items');
      const selecteds = document.getElementsByClassName('select-selected');
      for (let i = 0; i < selecteds.length; i++) {
        if (elmnt === selecteds[i]) {
          arrNo.push(i);
        } else {
          selecteds[i].parentNode.classList.remove('open');
        }
      }
      for (let i = 0; i < items.length; i++) {
        if (arrNo.indexOf(i) === -1) {
          items[i].classList.add('select-hide');
        }
      }
    }

    document.addEventListener('click', closeAllSelect);
    if(window.lucide) { lucide.createIcons(); }
  }
  
  createCustomDropdowns();
});
