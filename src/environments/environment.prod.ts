/**
 * Production environment
 */
export const environment = {
  production: true,
  version: require("../../package.json").version,
  gitlabApiURL: "https://gitlab.com/api",
  githubApiURL: "https://api.github.com",
};
