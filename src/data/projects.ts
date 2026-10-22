export interface Project {
  title: string;
  description: string;
  category: string;
  status: "online" | "development" | "archived";
  slug: string;
  overview: string;
}

export const projects: Project[] = [
  {
    title: "FirehawkOS",
    description: "A custom interface for my projects, homelab, and the things I’m building.",
    category: "WEB & INTERFACES",
    status: "development",
    slug: "firehawkos",
    overview: "FirehawkOS is the interface you’re exploring now: a personal website with a terminal, an interactive background, and space to share ongoing projects. It’s a work in progress that will grow alongside the things I build.",
  },
];
