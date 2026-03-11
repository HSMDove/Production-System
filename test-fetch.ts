import { fetchRSSFeed, getYouTubeRSSUrl, extractYouTubeVideoId } from './server/fetcher.ts';

async function test(url:string) {
  try {
    const res = await fetchRSSFeed({
      id: 'test',
      folderId: 'f',
      type: 'youtube',
      url,
      isActive: true,
      userId: 'u',
      name: 'test',
    } as any);
    console.log('URL', url, '=>', res.error || `${res.items.length} items`);
    if (res.items.length>0) console.log(res.items.map(i=>i.originalUrl).slice(0,3));
  } catch(e) {
    console.error('error for', url, e);
  }
}

(async () => {
  const urls = [
    'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    'https://www.youtube.com/@google',
    'https://www.youtube.com/c/Google',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/playlist?list=PL9tY0BWXOZFv1uOwfdSxm5lqqAXp-4u3N',
    'https://www.youtube.com/@google/videos',
    'https://www.youtube.com/@google/about',
    'https://www.youtube.com/@nonexistentrandomuser999999',
  ];
  for (const u of urls) {
    // show what the helper thinks the RSS URL would be
    console.log('helper url ->', getYouTubeRSSUrl(u));
    console.log('video id ->', extractYouTubeVideoId(u));
    await test(u);
  }
  process.exit(0);
})();
