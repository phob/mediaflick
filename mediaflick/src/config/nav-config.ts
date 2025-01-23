import { BookHeart, Home, Library, Settings, Bug } from "lucide-react";

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
  {
    icon: Bug,
    label: "Logs",
    href: "/logs",
  },
]

export const settingsItems = [
  {
    icon: Settings,
    label: "Settings",
    isSettings: true,
  },
]
