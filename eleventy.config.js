import fg from "fast-glob";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("**/*.pdf");

  for (const dir of fg.sync("material/**/diagrams", { onlyDirectories: true })) {
    eleventyConfig.addPassthroughCopy(dir);
  }

  return {
    dir: {
      includes: "_includes",
    },
    markdownTemplateEngine: "njk",
  };
}
