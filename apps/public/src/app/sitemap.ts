import type { MetadataRoute } from "next";
import { siteUrl } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    {
      url: `${siteUrl}/programa-de-fidelizacion`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/marketing-para-comercios`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/punto-de-venta`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${siteUrl}/es/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/es/tos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
