import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Atmos Weather", short_name: "Atmos", description: "Weather, clearly.", start_url: "/", display: "standalone", background_color: "#f4f3ef", theme_color: "#326a65", icons: [] }; }
