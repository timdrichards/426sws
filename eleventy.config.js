import fg from 'fast-glob'
import pluginSyntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight'

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginSyntaxHighlight)

  eleventyConfig.addCollection('prjPages', function (collectionApi) {
    return collectionApi
      .getFilteredByTag('prj')
      .sort((a, b) => (a.data.navOrder ?? 99) - (b.data.navOrder ?? 99))
  })
  eleventyConfig.addPassthroughCopy('css')
  eleventyConfig.addPassthroughCopy('**/*.png')
  eleventyConfig.addPassthroughCopy('**/*.svg')
  eleventyConfig.addPassthroughCopy('**/*.pdf')
  eleventyConfig.addPassthroughCopy('**/*.zip')

  for (const dir of fg.sync('material/**/diagrams', {
    onlyDirectories: true,
  })) {
    eleventyConfig.addPassthroughCopy(dir)
  }

  return {
    dir: {
      includes: '_includes',
    },
    markdownTemplateEngine: 'njk',
    pathPrefix: '/426sws/',
  }
}
