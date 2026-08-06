export const primaryNav = [
  { href: "/docs/", label: "Docs" },
  { href: "/agents/", label: "Agents" },
  { href: "/demo/", label: "Demo" },
  { href: "/community/", label: "Community" },
] as const;

export const footerLearn = [
  { href: "/docs/", label: "Documentation" },
  { href: "/install/", label: "Install" },
  { href: "/docs/user-guide/", label: "User Guide" },
  { href: "/docs/faq/", label: "FAQ" },
] as const;

export const footerAgents = [
  { href: "/agents/", label: "Agent overview" },
  { href: "/docs/AGENTS/", label: "AGENTS.md" },
  { href: "/docs/agent-recipes/", label: "Recipes" },
  { href: "/docs/json-api/", label: "JSON API" },
] as const;

export const footerContribute = [
  {
    href: "https://github.com/sshaaf/rgBuilder/blob/main/CONTRIBUTING.md",
    label: "Contributing",
    external: true,
  },
  {
    href: "https://github.com/sshaaf/rgBuilder/issues",
    label: "Issues",
    external: true,
  },
  {
    href: "https://github.com/sshaaf/rgBuilder/discussions",
    label: "Discussions",
    external: true,
  },
  {
    href: "https://github.com/sshaaf/rgBuilder/releases",
    label: "Releases",
    external: true,
  },
] as const;
