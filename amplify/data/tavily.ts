import { a } from '@aws-amplify/backend';
import { searchWebFn } from '../functions/tavily/search-web/resource';
// import { crawlWebsiteFn } from '../functions/tavily/crawl-website/resource';
 import { mapWebsiteFn } from '../functions/tavily/map-website/resource';
 import { extractWebContentFn } from '../functions/tavily/extract-web/resource';

export const WebSearchResult = a.customType({
  url: a.string().required(),
  title: a.string().required(),
  content: a.string().required()
})

export const WebSearchResponse = a.customType({
  results: a.ref('WebSearchResult').array().required()
})

// export const WebsiteCrawlPage = a.customType({
//   url: a.string().required(),
//   content: a.string().required()
// })

// export const WebsiteCrawlResponse = a.customType({
//   pages: a.ref('WebsiteCrawlPage').array().required()
// })

export const WebsiteMapResponse = a.customType({
  baseUrl: a.string().required(),
  urls: a.string().required().array().required()
})

export const searchWeb = a.query()
    .arguments({
      query: a.string().required(),
      maxResults: a.integer()
    })
    .returns(a.ref('WebSearchResponse'))
    .handler(a.handler.function(searchWebFn))
    .authorization(allow => allow.authenticated())

// export const crawlWebsite = a.query()
//   .arguments({
//     url: a.string().required(),
//     query: a.string(),
//     maxDepth: a.integer(),
//     maxResults: a.integer()
//   })
//   .returns(a.ref('WebsiteCrawlResponse'))
//   .handler(a.handler.function(searchWebFn))
//   .authorization(allow => allow.authenticated())

export const mapWebsite = a.query()
  .arguments({
    url: a.string().required(),
    query: a.string(),
    maxDepth: a.integer(),
    maxResults: a.integer()
  })
  .returns(a.ref('WebsiteMapResponse'))
  .handler(a.handler.function(mapWebsiteFn))
  .authorization(allow => allow.authenticated())

export const extractWebContent = a.query()
  .arguments({
    url: a.string().required(),
    query: a.string()
  })
  .returns(a.string())
  .handler(a.handler.function(extractWebContentFn))
  .authorization(allow => allow.authenticated())
