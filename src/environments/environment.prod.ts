/**
 * Production environment
 */
export const environment = {
  production: true,
  version: require("../../package.json").version,
  documentationUrl: "https://git4school.github.io/",
  gitlab: {
    clientId: "968f761fc1af187373cd90b2e5a1c04c5a3348ecff7e585eff50fd99086676d4",
    redirectUri: "/auth/callback",
    instanceUrl: "https://gitlab.com",
    scope: "read_api read_user",
  },
};
