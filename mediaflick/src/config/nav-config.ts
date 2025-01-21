import { BookHeart, Home, Library, Settings } from "lucide-react";

export const navigationItems = [
  {
    icon: Home,
    label: "Home",
    href: "/",
  },
  {
    icon: Library,
    label: "Library",
    href: "/mediainfo",
  },
  {
    icon: BookHeart,
    label: "Files",
    href: "/medialibrary",
  },
]

export const settingsItems = [
  {
    icon: Settings,
    label: "Settings",
    isSettings: true,
  },
]
