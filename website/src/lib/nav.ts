export const primaryNav = [
  { href: "/docs/", label: "Docs" },
  { href: "/agents/", label: "Agents" },
  { href: "/demo/", label: "Demo" },
  { href: "/community/", label: "Community" },
] as const;

export const footerLearn = [
  { href: "/docs/", label: "Documentation" },
  { href: "/install/", label: "Install" },
  { href: "/demo/", label: "Interactive demos" },
  {
    href: "https://github.com/sshaaf/rgBuilder/blob/main/docs/faq.md",
    label: "FAQ",
    external: true,
  },
] as const;

export const footerAgents = [
  { href: "/agents/", label: "Agent overview" },
  {
    href: "https://github.com/sshaaf/rgBuilder/blob/main/AGENTS.md",
    label: "AGENTS.md",
    external: true,
  },
  {
    href: "https://github.com/sshaaf/rgBuilder/blob/main/docs/agent-recipes.md",
    label: "Recipes",
    external: true,
  },
  {
    href: "https://github.com/sshaaf/rgBuilder/blob/main/docs/json-api.md",
    label: "JSON API",
    external: true,
  },
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
