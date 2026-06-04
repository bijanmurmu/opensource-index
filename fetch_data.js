const fs = require('fs');

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("No GITHUB_TOKEN provided. Please provide it as an environment variable.");
  process.exit(1);
}

async function fetchFromGitHub(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await res.json();
  if (body.errors) {
    console.error("GraphQL Errors:", JSON.stringify(body.errors, null, 2));
    process.exit(1);
  }
  return body.data;
}

async function fetchViewerProfile() {
  const query = `
    query {
      viewer {
        login
        name
        avatarUrl
        bio
        followers {
          totalCount
        }
      }
    }
  `;
  const data = await fetchFromGitHub(query);
  return data.viewer;
}

async function fetchAllIssues() {
  let hasNextPage = true;
  let cursor = null;
  const allIssues = [];

  while (hasNextPage) {
    const query = `
      query($cursor: String) {
        viewer {
          issues(first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              title url state number createdAt
              repository {
                nameWithOwner isPrivate stargazerCount
                primaryLanguage { name color }
                owner { __typename avatarUrl }
              }
              timelineItems(itemTypes: CROSS_REFERENCED_EVENT, first: 10) {
                nodes {
                  ... on CrossReferencedEvent {
                    source {
                      ... on PullRequest { number url }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await fetchFromGitHub(query, { cursor });
    const issuesData = data.viewer.issues;
    allIssues.push(...issuesData.nodes);
    hasNextPage = issuesData.pageInfo.hasNextPage;
    cursor = issuesData.pageInfo.endCursor;
  }
  return allIssues;
}

async function fetchAllPRs() {
  let hasNextPage = true;
  let cursor = null;
  const allPRs = [];

  while (hasNextPage) {
    const query = `
      query($cursor: String) {
        viewer {
          pullRequests(first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              title url state number additions deletions createdAt
              repository {
                nameWithOwner isPrivate stargazerCount
                primaryLanguage { name color }
                owner { __typename avatarUrl }
              }
              closingIssuesReferences(first: 10) {
                nodes {
                  number title url
                }
              }
              timelineItems(itemTypes: CROSS_REFERENCED_EVENT, first: 10) {
                nodes {
                  ... on CrossReferencedEvent {
                    source {
                      ... on Issue { number title url }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await fetchFromGitHub(query, { cursor });
    const prsData = data.viewer.pullRequests;
    allPRs.push(...prsData.nodes);
    hasNextPage = prsData.pageInfo.hasNextPage;
    cursor = prsData.pageInfo.endCursor;
  }
  return allPRs;
}

async function generateData() {
  console.log("Fetching profile...");
  const profile = await fetchViewerProfile();

  console.log("Fetching issues...");
  const issues = await fetchAllIssues();

  console.log("Fetching PRs...");
  const prs = await fetchAllPRs();

  const repoMeta = {};
  const yearsData = {}; // { '2024': { issues: {}, prs: {}, privateCounts: {...} } }

  function getYearData(dateStr) {
    const year = new Date(dateStr).getFullYear().toString();
    if (!yearsData[year]) {
      yearsData[year] = { issues: {}, prs: {}, privateCounts: { issues: 0, prs: 0, additions: 0, deletions: 0 } };
    }
    return yearsData[year];
  }

  issues.forEach(issue => {
    const yData = getYearData(issue.createdAt);
    if (issue.repository.isPrivate) {
      yData.privateCounts.issues++;
      return;
    }
    const repo = issue.repository.nameWithOwner;
    if (!repoMeta[repo]) {
      repoMeta[repo] = { language: issue.repository.primaryLanguage, stars: issue.repository.stargazerCount, ownerType: issue.repository.owner.__typename, avatarUrl: issue.repository.owner.avatarUrl };
    }
    if (!yData.issues[repo]) yData.issues[repo] = [];
    
    let linked_prs = [];
    const xrefs = issue.timelineItems.nodes;
    if (xrefs && xrefs.length > 0) {
      xrefs.forEach(x => {
        if (x.source && x.source.number) {
          if (!linked_prs.some(pr => pr.number === x.source.number)) {
            linked_prs.push({ number: x.source.number, url: x.source.url });
          }
        }
      });
    }
    yData.issues[repo].push({
      title: issue.title, url: issue.url, state: issue.state, number: issue.number, createdAt: issue.createdAt, linked_prs
    });
  });

  prs.forEach(pr => {
    const yData = getYearData(pr.createdAt);
    if (pr.repository.isPrivate) {
      yData.privateCounts.prs++;
      yData.privateCounts.additions += pr.additions;
      yData.privateCounts.deletions += pr.deletions;
      return;
    }
    const repo = pr.repository.nameWithOwner;
    if (!repoMeta[repo]) {
      repoMeta[repo] = { language: pr.repository.primaryLanguage, stars: pr.repository.stargazerCount, ownerType: pr.repository.owner.__typename, avatarUrl: pr.repository.owner.avatarUrl };
    }
    if (!yData.prs[repo]) yData.prs[repo] = [];

    let linked_issues = [];
    if (pr.closingIssuesReferences && pr.closingIssuesReferences.nodes) {
      pr.closingIssuesReferences.nodes.forEach(issue => {
        linked_issues.push({ number: issue.number, title: issue.title, url: issue.url });
      });
    }
    const xrefs = pr.timelineItems.nodes;
    if (xrefs && xrefs.length > 0) {
      xrefs.forEach(x => {
        if (x.source && x.source.number) {
          if (!linked_issues.some(i => i.number === x.source.number)) {
            linked_issues.push({ number: x.source.number, title: x.source.title, url: x.source.url });
          }
        }
      });
    }

    yData.prs[repo].push({
      title: pr.title, url: pr.url, state: pr.state, number: pr.number, createdAt: pr.createdAt, additions: pr.additions, deletions: pr.deletions, linked_issues
    });
  });

  const availableYears = Object.keys(yearsData).sort((a, b) => b - a);
  const meta = { profile, repoMeta, availableYears };
  
  fs.writeFileSync('data-meta.json', JSON.stringify(meta, null, 2));
  availableYears.forEach(year => {
    fs.writeFileSync(`data-${year}.json`, JSON.stringify(yearsData[year], null, 2));
  });
  
  console.log(`Data saved successfully. Generated data-meta.json and ${availableYears.length} year chunks.`);
}

generateData().catch(err => {
  console.error("Critical Error:", err);
  process.exit(1);
});
