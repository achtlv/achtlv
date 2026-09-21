// GitHub Release 加速
// 许可证: AGPL-3.0

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return new Response('服务器未配置 GitHub Token', { status: 500 });
    }

    // 1. 根路径重定向到 README
    if (url.pathname === '/') {
      return Response.redirect(
        'https://markdownreader.mutantcat.org/?url=https://v6.gh-proxy.org/https://raw.githubusercontent.com/achtlv/achtlv.github.io/main/gr.md',
        302
      );
    }

    const parts = url.pathname.split('/').filter(p => p.length > 0);
    if (parts.length > 4) {
      return new Response('最多支持 4 段路径', { status: 400 });
    }

    try {
      let owner, repo, releaseTag, selector;

      // 根据不同路径段数解析
      if (parts.length === 1) {
        // 1段：关键词搜索仓库，取第一个仓库的 latest release 的第一个 asset
        const keyword = parts[0];
        const repoInfo = await searchRepo(keyword, GITHUB_TOKEN);
        owner = repoInfo.owner;
        repo = repoInfo.repo;
        releaseTag = 'latest';
        selector = '1'; // 默认第一个
      } else if (parts.length === 2) {
        // 2段：关键词搜索仓库，取第一个仓库的 latest release，第二段作为选择器
        const keyword = parts[0];
        const repoInfo = await searchRepo(keyword, GITHUB_TOKEN);
        owner = repoInfo.owner;
        repo = repoInfo.repo;
        releaseTag = 'latest';
        selector = parts[1];
      } else if (parts.length === 3) {
        // 3段：原功能 /作者/仓库/选择器
        owner = parts[0];
        repo = parts[1];
        releaseTag = 'latest';
        selector = parts[2];
      } else if (parts.length === 4) {
        // 4段：/作者/仓库/release标签/选择器
        owner = parts[0];
        repo = parts[1];
        releaseTag = parts[2];
        selector = parts[3];
      }

      // 获取 assets 列表
      const assets = await getReleaseAssets(owner, repo, releaseTag, GITHUB_TOKEN);
      if (assets.length === 0) {
        return new Response('该 release 没有 assets', { status: 404 });
      }

      // 根据选择器匹配
      const targetUrl = selectAsset(assets, selector);
      const proxyUrl = `https://d.achtlv.ccwu.cc/${targetUrl}`;
      return Response.redirect(proxyUrl, 302);

    } catch (err) {
      const status = err.status || 500;
      return new Response(err.message, { status });
    }
  }
};

// ---------- 辅助函数 ----------

// 搜索仓库，返回第一个结果的 owner 和 repo
async function searchRepo(keyword, token) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Cloudflare-Worker',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`
    }
  });
  if (!response.ok) {
    const err = new Error(`仓库搜索失败: ${response.status}`);
    err.status = response.status === 403 ? 429 : 502;
    throw err;
  }
  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    const err = new Error(`未找到与 "${keyword}" 匹配的仓库`);
    err.status = 404;
    throw err;
  }
  const fullName = data.items[0].full_name; // "owner/repo"
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
}

// 获取指定 release 的 assets 列表（releaseTag 可为 'latest' 或具体标签）
async function getReleaseAssets(owner, repo, releaseTag, token) {
  let apiUrl;
  if (releaseTag === 'latest') {
    apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  } else {
    apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(releaseTag)}`;
  }
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Cloudflare-Worker',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`
    }
  });
  if (!response.ok) {
    const err = new Error(`获取 release 失败: ${response.status}`);
    err.status = response.status === 404 ? 404 : 502;
    throw err;
  }
  const data = await response.json();
  if (!data.assets || data.assets.length === 0) {
    const err = new Error('该 release 没有 assets');
    err.status = 404;
    throw err;
  }
  return data.assets.map(asset => asset.browser_download_url);
}

// 根据选择器（数字或关键词）从 assets 中匹配一个 URL
function selectAsset(assets, selector) {
  const isNumeric = /^\d+$/.test(selector);
  if (isNumeric) {
    const index = parseInt(selector, 10) - 1;
    if (index < 0 || index >= assets.length) {
      const err = new Error(`索引 ${selector} 超出范围，共 ${assets.length} 个assets`);
      err.status = 404;
      throw err;
    }
    return assets[index];
  } else {
    // 关键词匹配（区分大小写）
    const matched = assets.find(url => {
      const fileName = url.split('/').pop();
      return fileName.includes(selector);
    });
    if (!matched) {
      const err = new Error(`未找到文件名包含 "${selector}" 的assets`);
      err.status = 404;
      throw err;
    }
    return matched;
  }
}