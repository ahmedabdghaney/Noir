import { useEffect, useState } from 'react';
import { fetchTitleLogo } from '../lib/tmdb';

interface TitleLogoProps {
  type: 'movie' | 'tv';
  id: number;
  title: string;
  className?: string;
  fallbackClassName?: string;
}

export default function TitleLogo({ type, id, title, className = '', fallbackClassName = '' }: TitleLogoProps) {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLogo(null);
    fetchTitleLogo(type, id).then((result) => {
      if (!cancelled) setLogo(result);
    });
    return () => { cancelled = true; };
  }, [type, id]);

  if (logo) {
    return <img src={logo} alt={title} className={className} loading="eager" decoding="async" referrerPolicy="no-referrer" />;
  }

  return <span className={fallbackClassName}>{title}</span>;
}
