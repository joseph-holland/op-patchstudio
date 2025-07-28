import axios from 'axios';

export interface PatreonPost {
  title: string;
  excerpt: string;
  url: string;
  date: string;
}

interface PatreonApiResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      title: string;
      content: string;
      published_at: string;
      url: string;
    };
  }>;
}

export async function scrapePatreonPosts(): Promise<PatreonPost[]> {
  try {
    const apiUrl = 'https://www.patreon.com/api/posts';
    const campaignId = '14433645'; // Your Patreon campaign ID
    
    const headers = {
      'Accept-Language': 'en-US,en;q=0.5'
    };

    // Try different CORS proxies if one fails
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://thingproxy.freeboard.io/fetch/'
    ];
    


    // Try different CORS proxies until one works
    let apiResponse: any = null;
    
    for (const proxy of corsProxies) {
      try {
        const apiUrlWithParams = `${apiUrl}?filter[campaign_id]=${campaignId}&sort=-published_at&page[size]=5`;
        
        apiResponse = await axios.get<PatreonApiResponse>(proxy + encodeURIComponent(apiUrlWithParams), {
          headers,
          timeout: 10000
        });

        // If we get a response with data, break out of the loop
        if (apiResponse.data && Object.keys(apiResponse.data).length > 0) {
          break;
        }
              } catch (error) {
          continue;
        }
    }
    
    if (!apiResponse || !apiResponse.data || Object.keys(apiResponse.data).length === 0) {
      return getFallbackPosts();
    }

    const posts: PatreonPost[] = [];

    if (apiResponse.data && apiResponse.data.data) {
      apiResponse.data.data.forEach((post: any) => {
        const { title, content, published_at, url } = post.attributes;
        
        // Create excerpt from content (preserve basic formatting, limit to 100 words)
        let html = content
          .replace(/<\s*br\s*\/?>/gi, '\n') // <br> to newline
          .replace(/<\s*\/p\s*>/gi, '\n')  // </p> to newline
          .replace(/<\s*p\s*>/gi, '')        // remove <p> open tags
          .replace(/<\s*\/li\s*>/gi, '\n') // </li> to newline
          .replace(/<\s*li\s*>/gi, '• ');    // <li> to bullet
        // Remove all tags except a safe list
        html = html.replace(/<(?!\/?(b|i|strong|em|ul|ol|li|a|p|br)\b)[^>]*>/gi, '');
        // Normalize whitespace but preserve newlines
        html = html.replace(/[ \t]+/g, ' ').trim();
        // Split into words and limit to 80
        const words = html.split(' ');
        const truncatedHtml = words.length > 80 ? words.slice(0, 80).join(' ') + '...' : html;
        // Convert newlines to <br> tags for HTML display
        const excerpt = truncatedHtml.replace(/\n/g, '<br>');

        posts.push({
          title: title || 'untitled post',
          excerpt,
          url: url || `https://www.patreon.com/posts/${post.id}`,
          date: published_at ? new Date(published_at).toLocaleDateString() : 'recent'
        });
      });
    } else {
      // No data found in API response
    }

    if (posts.length > 0) {
      return posts;
    }

    return getFallbackPosts();

  } catch (error) {
    console.error('Failed to fetch Patreon posts:', error);
    return getFallbackPosts();
  }
}

function getFallbackPosts(): PatreonPost[] {
  return [
    {
      title: "join me on this journey",
      excerpt: "follow along as we build something amazing together...",
      url: "https://www.patreon.com/c/oppatchstudio/posts",
      date: "recent"
    },
    {
      title: "good things are coming",
      excerpt: "exciting updates and new features are on the horizon...",
      url: "https://www.patreon.com/c/oppatchstudio/posts",
      date: "recent"
    },
    {
      title: "aif support added",
      excerpt: "new audio format support has been added to op-patchstudio...",
      url: "https://www.patreon.com/c/oppatchstudio/posts",
      date: "recent"
    }
  ];
} 