import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { nl } from 'date-fns/locale';

export const formatRelativeDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isToday(dateObj)) {
    return `Vandaag ${format(dateObj, 'HH:mm')}`;
  }

  if (isYesterday(dateObj)) {
    return 'Gisteren';
  }

  const daysAgo = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

  if (daysAgo < 7) {
    return `${daysAgo} ${daysAgo === 1 ? 'dag' : 'dagen'} geleden`;
  }

  return format(dateObj, 'd MMM yyyy', { locale: nl });
};
