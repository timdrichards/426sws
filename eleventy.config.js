export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");

  return {
    dir: {
      includes: "_includes",
    },
    markdownTemplateEngine: "njk",
  };
}
