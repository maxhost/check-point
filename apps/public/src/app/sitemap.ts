import type { MetadataRoute } from "next";
import { siteUrl } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl, changeFrequency: "weekly", priority: 1 }];
}
