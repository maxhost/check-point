import type { MetadataRoute } from "next";
import { siteUrl } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/es/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/es/tos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
