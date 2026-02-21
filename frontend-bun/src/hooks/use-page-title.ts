import { useEffect } from 'react';
import { siteConfig } from '@/config/site';

export const usePageTitle = (title?: string) => {
  useEffect(() => {
    document.title = title 
      ? `${title} | ${siteConfig.name}`
      : siteConfig.name;
  }, [title]);
}; 