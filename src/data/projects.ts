export interface Project {
  title: string;
  description: string;
  category: string;
  status: "online" | "development" | "archived";
  slug: string;
  github?: string;
}

export const projects: Project[] = [
  {
    title: "Homelab",
    description:
      "Servers, networking, virtualization, storage, and the mildly irresponsible amount of hardware behind it all.",
    category: "INFRASTRUCTURE",
    status: "development",
    slug: "homelab",
  },
  {
    title: "Minecraft Network",
    description:
      "Custom servers, routing, proxies, mods, and the chaos required to keep everything online.",
    category: "GAME SYSTEMS",
    status: "development",
    slug: "minecraft-network",
  },
  {
    title: "Security Lab",
    description:
      "Isolated environments for testing tools, policies, endpoints, and security ideas.",
    category: "CYBERSECURITY",
    status: "development",
    slug: "security-lab",
  },
  {
    title: "Web Experiments",
    description:
      "Animations, interfaces, mouse effects, strange interactions, and ideas that probably did not need to exist.",
    category: "CREATIVE CODE",
    status: "online",
    slug: "web-experiments",
    github: "https://github.com/Firehawk6",
  },
];
