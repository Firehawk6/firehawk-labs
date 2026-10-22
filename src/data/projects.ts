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
    title: "Langton’s Ant",
    description: "Simple rules, unpredictable patterns. An interactive ant simulation with multiple ants, custom palettes, and room to explore.",
    category: "SIMULATIONS",
    status: "online",
    slug: "langtons-ant",
    overview: "My original Langton’s ant simulation, rebuilt for Firehawk Labs with a responsive canvas and controls for exploring its patterns.",
  },
  {
    title: "FirehawkOS",
    description: "A custom interface for my projects, homelab, and the things I’m building.",
    category: "WEB & INTERFACES",
    status: "development",
    slug: "firehawkos",
    overview: "FirehawkOS is the interface you’re exploring now: a personal website with a terminal, an interactive background, and space to share ongoing projects. It’s a work in progress that will grow alongside the things I build.",
  },
];
